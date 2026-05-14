import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const VMPAY_BASE = "https://vmpay.vertitecnologia.com.br/api/v1";

async function vmpayFetch(path: string) {
  const apiKey = process.env.VMPAY_API_KEY;
  if (!apiKey) throw new Error("VMPAY_API_KEY não configurada");
  const sep = path.includes("?") ? "&" : "?";
  const url = `${VMPAY_BASE}${path}${sep}access_token=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`VMPay ${path} → ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ===== SEARCH (autenticado) =====
export const searchPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        query: z.string().max(200).optional(),
        machineId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("machine_products")
      .select(
        "id, desired_price, logical_locator, current_balance, status, machine:machines(id, asset_number, place), product:products(id, name, description, barcode, upc_code)",
      )
      .not("desired_price", "is", null)
      .order("desired_price", { ascending: true })
      .limit(500);

    if (data.machineId) q = q.eq("machine_id", data.machineId);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const term = data.query?.trim().toLowerCase();
    const filtered = term
      ? (rows ?? []).filter((r: any) => {
          const p = r.product;
          if (!p) return false;
          return (
            p.name?.toLowerCase().includes(term) ||
            p.barcode?.toLowerCase().includes(term) ||
            p.upc_code?.toLowerCase().includes(term)
          );
        })
      : rows ?? [];

    return { items: filtered };
  });

export const listMachines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("machines")
      .select("id, asset_number, place, vmpay_machine_id")
      .order("asset_number");
    if (error) throw new Error(error.message);
    return { machines: data ?? [] };
  });

export const getSyncStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [products, machines, prices, lastLog] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("machines").select("id", { count: "exact", head: true }),
      supabase.from("machine_products").select("id", { count: "exact", head: true }),
      supabase
        .from("sync_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    return {
      productsCount: products.count ?? 0,
      machinesCount: machines.count ?? 0,
      pricesCount: prices.count ?? 0,
      lastSync: lastLog.data ?? null,
    };
  });

// ===== SYNC (autenticado) =====
export const syncVmpay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const startedAt = Date.now();
    const userId = context.userId;
    let machinesCount = 0;
    let productsCount = 0;
    let pricesCount = 0;

    try {
      // 1. Sync products catalog
      const products = (await vmpayFetch("/products")) as any[];
      if (Array.isArray(products) && products.length > 0) {
        const productRows = products
          .filter((p) => p?.id)
          .map((p) => ({
            vmpay_good_id: p.id,
            name: p.name ?? `Produto ${p.id}`,
            description: p.description ?? null,
            upc_code: p.upc_code ?? null,
            barcode: p.barcode ?? null,
            category_id: p.category_id ?? null,
            manufacturer_id: p.manufacturer_id ?? null,
            tags: p.tags ?? null,
          }));
        const { error } = await supabaseAdmin
          .from("products")
          .upsert(productRows, { onConflict: "vmpay_good_id" });
        if (error) throw new Error(`upsert products: ${error.message}`);
        productsCount = productRows.length;
      }

      // 2. Sync machines
      const machines = (await vmpayFetch("/machines")) as any[];
      if (!Array.isArray(machines)) throw new Error("Retorno /machines inválido");

      const machineRows = machines
        .filter((m) => m?.id)
        .map((m) => ({
          vmpay_machine_id: m.id,
          asset_number: m.asset_number ?? null,
          installation_id: m.installation?.id ?? null,
          location_id: m.installation?.location_id ?? null,
          place: m.installation?.place ?? null,
          tags: m.tags ?? null,
        }));

      const { error: mErr } = await supabaseAdmin
        .from("machines")
        .upsert(machineRows, { onConflict: "vmpay_machine_id" });
      if (mErr) throw new Error(`upsert machines: ${mErr.message}`);
      machinesCount = machineRows.length;

      // 3. Map vmpay_good_id → product uuid, vmpay_machine_id → machine uuid
      const { data: productMap } = await supabaseAdmin
        .from("products")
        .select("id, vmpay_good_id");
      const { data: machineMap } = await supabaseAdmin
        .from("machines")
        .select("id, vmpay_machine_id, installation_id");

      const productByGoodId = new Map<number, string>();
      productMap?.forEach((p: any) => productByGoodId.set(Number(p.vmpay_good_id), p.id));
      const machineByVmpayId = new Map<number, { id: string; installation_id: number | null }>();
      machineMap?.forEach((m: any) =>
        machineByVmpayId.set(Number(m.vmpay_machine_id), {
          id: m.id,
          installation_id: m.installation_id,
        }),
      );

      // 4. For each machine with installation, fetch current planogram
      for (const m of machines) {
        const installationId = m.installation?.id;
        if (!installationId) continue;
        const machineRow = machineByVmpayId.get(Number(m.id));
        if (!machineRow) continue;

        let planogram: any;
        try {
          planogram = await vmpayFetch(
            `/machines/${m.id}/installations/${installationId}/current_planogram`,
          );
        } catch (e) {
          console.warn(`Planograma máquina ${m.id} falhou`, e);
          continue;
        }

        const items: any[] = planogram?.items ?? [];
        const priceRows = items
          .filter((it) => it?.good_id && productByGoodId.has(Number(it.good_id)))
          .map((it) => ({
            machine_id: machineRow.id,
            product_id: productByGoodId.get(Number(it.good_id))!,
            desired_price: it.desired_price ?? null,
            logical_locator: it.logical_locator != null ? String(it.logical_locator) : "0",
            current_balance: it.current_balance ?? null,
            status: it.status ?? null,
          }));

        if (priceRows.length > 0) {
          const { error: pErr } = await supabaseAdmin
            .from("machine_products")
            .upsert(priceRows, { onConflict: "machine_id,product_id,logical_locator" });
          if (pErr) {
            console.warn(`upsert preços máquina ${m.id}:`, pErr.message);
            continue;
          }
          pricesCount += priceRows.length;
        }
      }

      await supabaseAdmin.from("sync_logs").insert({
        user_id: userId,
        status: "success",
        machines_count: machinesCount,
        products_count: productsCount,
        prices_count: pricesCount,
        duration_ms: Date.now() - startedAt,
      });

      return {
        success: true,
        machinesCount,
        productsCount,
        pricesCount,
        durationMs: Date.now() - startedAt,
      };
    } catch (err: any) {
      const message = err?.message ?? String(err);
      await supabaseAdmin.from("sync_logs").insert({
        user_id: userId,
        status: "error",
        machines_count: machinesCount,
        products_count: productsCount,
        prices_count: pricesCount,
        error_message: message.slice(0, 1000),
        duration_ms: Date.now() - startedAt,
      });
      throw new Error(message);
    }
  });
