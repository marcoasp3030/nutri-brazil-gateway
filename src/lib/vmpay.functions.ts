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
        query: z.string().optional().transform((v) => v?.slice(0, 200) || undefined),
        machineId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("machine_products")
      .select(
        "id, desired_price, logical_locator, current_balance, status, machine:machines(id, asset_number, place, location_name), product:products(id, name, description, barcode, upc_code)",
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
      .select("id, asset_number, place, location_name, vmpay_machine_id, installation_id")
      .order("location_name", { nullsFirst: false });
    if (error) throw new Error(error.message);
    return { machines: data ?? [] };
  });

// ===== Consulta AO VIVO de preço por máquina + código de barras =====
export const lookupPriceLive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        machineId: z.string().uuid(),
        barcode: z.string().trim().min(3).max(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // 1. Achar máquina
    const { data: machine, error: mErr } = await supabase
      .from("machines")
      .select("id, vmpay_machine_id, installation_id, asset_number, location_name, place")
      .eq("id", data.machineId)
      .single();
    if (mErr || !machine) throw new Error("Máquina não encontrada");
    if (!machine.installation_id) throw new Error("Máquina sem instalação no VMPay");

    // 2. Achar produto(s) pelo código de barras / upc
    const { data: products } = await supabase
      .from("products")
      .select("id, vmpay_good_id, name, barcode, upc_code")
      .or(`barcode.eq.${data.barcode},upc_code.eq.${data.barcode}`);

    if (!products || products.length === 0) {
      return {
        found: false,
        reason: "Código de barras não encontrado no catálogo",
        machineLabel: machine.location_name ?? machine.place ?? machine.asset_number,
      };
    }

    const goodIds = new Set(products.map((p: any) => Number(p.vmpay_good_id)));

    // 3. Buscar planograma ao vivo
    const planogram = await vmpayFetch(
      `/machines/${machine.vmpay_machine_id}/installations/${machine.installation_id}/current_planogram`,
    );
    const items: any[] = planogram?.items ?? [];

    // 4. Achar item com good_id correspondente
    const match = items.find((it) => it?.good_id && goodIds.has(Number(it.good_id)));
    const product = match
      ? products.find((p: any) => Number(p.vmpay_good_id) === Number(match.good_id))
      : products[0];

    return {
      found: !!match,
      machineLabel: machine.location_name ?? machine.place ?? machine.asset_number,
      product: product
        ? { name: product.name, barcode: product.barcode, upc_code: product.upc_code }
        : null,
      price: match?.desired_price ?? null,
      balance: match?.current_balance ?? null,
      locator: match?.logical_locator ?? null,
      status: match?.status ?? null,
      reason: match ? null : "Produto não está no planograma desta máquina",
    };
  });


// ===== SYNC apenas a lista de máquinas + produtos (rápido) =====
export const syncMachineList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const startedAt = Date.now();
    const userId = context.userId;
    let machinesCount = 0;
    let productsCount = 0;

    try {
      // 1. Catálogo de produtos
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

      // 2. Máquinas
      const machines = (await vmpayFetch("/machines")) as any[];
      if (!Array.isArray(machines)) throw new Error("Retorno /machines inválido");

      // 3. Buscar clientes (/clients) e mapear location_id → nome do cliente
      const clientNameByLocationId = new Map<number, string>();
      try {
        const clients = (await vmpayFetch("/clients")) as any[];
        if (Array.isArray(clients)) {
          for (const c of clients) {
            if (c?.main_location_id != null) {
              clientNameByLocationId.set(
                Number(c.main_location_id),
                c.name ?? c.corporate_name ?? `Cliente ${c.id}`,
              );
            }
          }
        }
      } catch {
        // /clients indisponível — segue sem nome
      }

      const machineRows = machines
        .filter((m) => m?.id)
        .map((m) => {
          const locId = m.installation?.location_id ?? null;
          return {
            vmpay_machine_id: m.id,
            asset_number: m.asset_number ?? null,
            installation_id: m.installation?.id ?? null,
            location_id: locId,
            location_name: locId != null ? clientNameByLocationId.get(Number(locId)) ?? null : null,
            place: m.installation?.place ?? null,
            tags: m.tags ?? null,
          };
        });

      const { error: mErr } = await supabaseAdmin
        .from("machines")
        .upsert(machineRows, { onConflict: "vmpay_machine_id" });
      if (mErr) throw new Error(`upsert machines: ${mErr.message}`);
      machinesCount = machineRows.length;

      await supabaseAdmin.from("sync_logs").insert({
        user_id: userId,
        status: "success",
        machines_count: machinesCount,
        products_count: productsCount,
        prices_count: 0,
        duration_ms: Date.now() - startedAt,
      });

      return { success: true, machinesCount, productsCount, durationMs: Date.now() - startedAt };
    } catch (err: any) {
      const message = err?.message ?? String(err);
      await supabaseAdmin.from("sync_logs").insert({
        user_id: userId,
        status: "error",
        machines_count: machinesCount,
        products_count: productsCount,
        prices_count: 0,
        error_message: message.slice(0, 1000),
        duration_ms: Date.now() - startedAt,
      });
      throw new Error(message);
    }
  });

// ===== SYNC planograma de UMA máquina (teste) =====
export const syncMachinePlanogram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ machineId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: machine, error: mErr } = await supabase
      .from("machines")
      .select("id, vmpay_machine_id, installation_id, asset_number, location_name")
      .eq("id", data.machineId)
      .single();
    if (mErr || !machine) throw new Error("Máquina não encontrada");
    if (!machine.installation_id) throw new Error("Máquina sem instalação no VMPay");

    const planogram = await vmpayFetch(
      `/machines/${machine.vmpay_machine_id}/installations/${machine.installation_id}/current_planogram`,
    );

    const { data: productMap } = await supabaseAdmin
      .from("products")
      .select("id, vmpay_good_id");
    const productByGoodId = new Map<number, string>();
    productMap?.forEach((p: any) => productByGoodId.set(Number(p.vmpay_good_id), p.id));

    const items: any[] = planogram?.items ?? [];
    const priceRows = items
      .filter((it) => it?.good_id && productByGoodId.has(Number(it.good_id)))
      .map((it) => ({
        machine_id: machine.id,
        product_id: productByGoodId.get(Number(it.good_id))!,
        desired_price: it.desired_price ?? null,
        logical_locator: it.logical_locator != null ? String(it.logical_locator) : "0",
        current_balance: it.current_balance ?? null,
        status: it.status ?? null,
      }));

    // Apaga preços antigos desta máquina e insere novos
    await supabaseAdmin.from("machine_products").delete().eq("machine_id", machine.id);

    if (priceRows.length > 0) {
      const { error: pErr } = await supabaseAdmin.from("machine_products").insert(priceRows);
      if (pErr) throw new Error(`insert preços: ${pErr.message}`);
    }

    return {
      success: true,
      pricesCount: priceRows.length,
      itemsCount: items.length,
      machineLabel: machine.location_name ?? machine.asset_number ?? "máquina",
    };
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

