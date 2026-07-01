import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const VMPAY_BASE = "https://vmpay.vertitecnologia.com.br/api/v1";

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getMachineLabel(machine: any) {
  return firstText(
    machine?.location_name,
    machine?.place,
    machine?.asset_number,
    machine?.vmpay_machine_id != null ? `Máquina ${machine.vmpay_machine_id}` : null,
  ) ?? "Máquina sem identificação";
}

async function logEntry(entry: {
  syncId?: string | null;
  endpoint: string;
  page?: number | null;
  attempt: number;
  status_code?: number | null;
  ok: boolean;
  duration_ms: number;
  error_message?: string | null;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("sync_log_entries").insert({
      sync_id: entry.syncId ?? null,
      endpoint: entry.endpoint,
      page: entry.page ?? null,
      attempt: entry.attempt,
      status_code: entry.status_code ?? null,
      ok: entry.ok,
      duration_ms: entry.duration_ms,
      error_message: entry.error_message ?? null,
    });
  } catch {
    // não deixa falha de log quebrar a sync
  }
}

async function vmpayFetch(
  path: string,
  opts: { retries?: number; timeoutMs?: number; logEndpoint?: string; page?: number | null; syncId?: string | null } = {},
) {
  const apiKey = process.env.VMPAY_API_KEY;
  if (!apiKey) throw new Error("VMPAY_API_KEY não configurada");
  const sep = path.includes("?") ? "&" : "?";
  const url = `${VMPAY_BASE}${path}${sep}access_token=${encodeURIComponent(apiKey)}`;
  const retries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 60000;
  const endpointLabel = opts.logEndpoint ?? path.split("?")[0];
  let lastErr: any;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const start = Date.now();
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
      clearTimeout(t);
      const dur = Date.now() - start;
      if (res.ok) {
        await logEntry({ syncId: opts.syncId ?? null, endpoint: endpointLabel, page: opts.page ?? null, attempt, status_code: res.status, ok: true, duration_ms: dur });
        return res.json();
      }
      const text = await res.text().catch(() => "");
      const errMsg = `HTTP ${res.status} ${text.slice(0, 200)}`;
      await logEntry({ syncId: opts.syncId ?? null, endpoint: endpointLabel, page: opts.page ?? null, attempt, status_code: res.status, ok: false, duration_ms: dur, error_message: errMsg });
      if ([408, 429, 500, 502, 503, 504, 520, 522, 524].includes(res.status) && attempt <= retries) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      throw new Error(`VMPay ${path} → ${res.status} ${text.slice(0, 200)}`);
    } catch (e: any) {
      clearTimeout(t);
      const dur = Date.now() - start;
      lastErr = e;
      const isAbort = e?.name === "AbortError";
      const msg = isAbort ? `timeout ${timeoutMs}ms` : e?.message ?? String(e);
      // se já logamos HTTP acima, não duplica
      if (isAbort || !(e?.message ?? "").startsWith("VMPay ")) {
        await logEntry({ syncId: opts.syncId ?? null, endpoint: endpointLabel, page: opts.page ?? null, attempt, ok: false, duration_ms: dur, error_message: msg });
      }
      if (attempt <= retries) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

async function vmpayFetchPaginated(basePath: string, perPage = 100, maxPages = 200, syncId?: string | null): Promise<any[]> {
  const all: any[] = [];
  const concurrency = 4;
  const sep = basePath.includes("?") ? "&" : "?";
  let nextPage = 1;
  let done = false;
  while (!done && nextPage <= maxPages) {
    const pages = Array.from({ length: concurrency }, (_, i) => nextPage + i).filter((p) => p <= maxPages);
    const results = await Promise.all(
      pages.map((page) =>
        vmpayFetch(`${basePath}${sep}per_page=${perPage}&page=${page}`, {
          logEndpoint: basePath,
          page,
          syncId,
        }) as Promise<any[]>,
      ),
    );
    for (const batch of results) {
      if (!Array.isArray(batch) || batch.length === 0) { done = true; continue; }
      all.push(...batch);
      if (batch.length < perPage) done = true;
    }
    nextPage += concurrency;
  }
  return all;
}

async function upsertInChunks(table: string, rows: any[], onConflict: string, chunkSize = 500) {
  if (rows.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const { error } = await (supabaseAdmin.from(table as any) as any).upsert(slice, { onConflict });
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
  }
}

function buildMachineRows(
  machines: any[],
  clientNameByLocationId = new Map<number, string>(),
  locationNameById = new Map<number, string>(),
) {
  return machines
    .filter((m) => m?.id)
    .map((m) => {
      const locId = m.installation?.location_id ?? null;
      const locNum = locId != null ? Number(locId) : null;
      const locationName = locNum != null ? locationNameById.get(locNum) ?? null : null;
      const clientName = locNum != null ? clientNameByLocationId.get(locNum) ?? null : null;
      const installationPlace = firstText(m.installation?.place);
      return {
        vmpay_machine_id: m.id,
        asset_number: m.asset_number ?? null,
        installation_id: m.installation?.id ?? null,
        location_id: locId,
        location_name: clientName ?? locationName ?? installationPlace,
        place: locationName ?? installationPlace,
        tags: m.tags ?? null,
      };
    });
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
    const term = data.query?.trim();

    let productIds: string[] | null = null;
    if (term) {
      const [byName, byBarcode, byUpc] = await Promise.all([
        supabase.from("products").select("id").ilike("name", `%${term}%`).limit(100),
        supabase.from("products").select("id").ilike("barcode", `%${term}%`).limit(100),
        supabase.from("products").select("id").ilike("upc_code", `%${term}%`).limit(100),
      ]);

      const productError = byName.error ?? byBarcode.error ?? byUpc.error;
      if (productError) throw new Error(productError.message);

      productIds = Array.from(
        new Set([
          ...(byName.data ?? []).map((p) => p.id),
          ...(byBarcode.data ?? []).map((p) => p.id),
          ...(byUpc.data ?? []).map((p) => p.id),
        ]),
      );

      if (productIds.length === 0) return { items: [] };
    }

    let q = supabase
      .from("machine_products")
      .select(
        "id, desired_price, logical_locator, current_balance, status, machine:machines(id, asset_number, place, location_name), product:products(id, name, description, barcode, upc_code)",
      )
      .not("desired_price", "is", null)
      .order("desired_price", { ascending: true })
      .limit(500);

    if (data.machineId) q = q.eq("machine_id", data.machineId);
    if (productIds) q = q.in("product_id", productIds);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    return { items: rows ?? [] };
  });

export const listMachines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("machines")
      .select("id, asset_number, place, location_name, vmpay_machine_id, installation_id")
      .order("location_name", { nullsFirst: false })
      .order("place", { nullsFirst: false })
      .order("asset_number", { nullsFirst: false })
      .range(0, 4999);
    if (error) throw new Error(error.message);
    return {
      machines: (data ?? []).map((machine) => ({
        ...machine,
        client_name: machine.location_name,
        display_name: getMachineLabel(machine),
      })).sort((a, b) =>
        getMachineLabel(a).localeCompare(getMachineLabel(b), "pt-BR", {
          sensitivity: "base",
          numeric: true,
        }),
      ),
    };
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

    // Consulta única no banco — JOIN entre machine_products + products + machines
    // Filtra pela máquina e pelo barcode/upc do produto. Resposta instantânea.
    const { data: rows, error } = await supabase
      .from("machine_products")
      .select(
        "desired_price, current_balance, status, logical_locator, machine:machines!inner(id, asset_number, location_name, place), product:products!inner(name, barcode, upc_code)",
      )
      .eq("machine_id", data.machineId)
      .or(`barcode.eq.${data.barcode},upc_code.eq.${data.barcode}`, {
        foreignTable: "products",
      })
      .limit(1);

    if (error) throw new Error(error.message);

    if (!rows || rows.length === 0) {
      // Buscar nome da máquina para mensagem amigável
      const { data: machine } = await supabase
        .from("machines")
        .select("asset_number, location_name, place")
        .eq("id", data.machineId)
        .single();

      // Verificar se o código existe no catálogo
      const { data: prod } = await supabase
        .from("products")
        .select("id")
        .or(`barcode.eq.${data.barcode},upc_code.eq.${data.barcode}`)
        .limit(1);

      return {
        found: false,
        machineLabel: machine ? getMachineLabel(machine) : "",
        reason:
          !prod || prod.length === 0
            ? "Código de barras não encontrado no catálogo"
            : "Produto não está no planograma desta máquina. Sincronize os preços desta máquina.",
      };
    }

    const row: any = rows[0];
    return {
      found: true,
      machineLabel: getMachineLabel(row.machine),
      product: {
        name: row.product?.name,
        barcode: row.product?.barcode,
        upc_code: row.product?.upc_code,
      },
      price: row.desired_price,
      balance: row.current_balance,
      locator: row.logical_locator,
      status: row.status,
      reason: null,
    };
  });


// ===== SYNC apenas a lista de máquinas + produtos (rápido) =====
export const syncMachineList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const startedAt = Date.now();
    const userId = context.userId;
    let machinesCount = 0;
    let productsCount = 0;
    const warnings: string[] = [];

    // Marca como "stalled" qualquer sync "running" cuja última requisição tenha
    // mais de 3 minutos (worker foi morto no meio) — ou antiga (>30min sem logs).
    const staleCutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const { data: runningRuns } = await supabaseAdmin
      .from("sync_logs")
      .select("id, created_at")
      .eq("status", "running");
    if (runningRuns && runningRuns.length > 0) {
      for (const r of runningRuns) {
        const { data: lastEntry } = await supabaseAdmin
          .from("sync_log_entries")
          .select("created_at")
          .eq("sync_id", r.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const lastAt = lastEntry?.created_at ?? r.created_at;
        if (lastAt < staleCutoff) {
          await supabaseAdmin
            .from("sync_logs")
            .update({
              status: "error",
              error_message: "Interrompida — worker expirou antes de finalizar",
              duration_ms: Date.now() - new Date(r.created_at).getTime(),
            })
            .eq("id", r.id);
        }
      }
    }

    // Cria a linha de sync já no início para vincular logs detalhados
    const { data: syncRow } = await supabaseAdmin
      .from("sync_logs")
      .insert({
        user_id: userId,
        status: "running",
        machines_count: 0,
        products_count: 0,
        prices_count: 0,
      })
      .select("id")
      .single();
    const syncId = syncRow?.id ?? null;

    const updateProgress = async (patch: Record<string, any>) => {
      if (!syncId) return;
      await (supabaseAdmin.from("sync_logs") as any).update(patch).eq("id", syncId);
    };


    try {
      // Fase 1: /machines + /clients em paralelo (rápidos e essenciais)
      const [machinesRes, clientsRes] = await Promise.allSettled([
        vmpayFetchPaginated("/machines", 200, 50, syncId),
        vmpayFetchPaginated("/clients", 200, 20, syncId),
      ]);

      if (machinesRes.status !== "fulfilled" || !Array.isArray(machinesRes.value)) {
        throw new Error(`/machines falhou: ${machinesRes.status === "rejected" ? machinesRes.reason?.message : "retorno inválido"}`);
      }
      const machines = machinesRes.value;

      const clientNameById = new Map<number, string>();
      if (clientsRes.status === "fulfilled" && Array.isArray(clientsRes.value)) {
        for (const c of clientsRes.value) {
          if (c?.id != null) {
            const clientName = firstText(c.name, c.corporate_name, `Cliente ${c.id}`);
            if (clientName) clientNameById.set(Number(c.id), clientName);
          }
        }
      } else if (clientsRes.status === "rejected") {
        warnings.push(`clientes: ${clientsRes.reason?.message ?? String(clientsRes.reason)}`);
      }

      // Fase 2: /locations com CAP baixo (evita loop infinito). Se falhar/estourar,
      // seguimos usando installation.place como fallback.
      const clientNameByLocationId = new Map<number, string>();
      const locationNameById = new Map<number, string>();
      try {
        const locations = await vmpayFetchPaginated("/locations", 200, 15, syncId);
        for (const l of locations) {
          if (l?.id == null) continue;
          const locId = Number(l.id);
          const locationName = firstText(l.name);
          if (locationName) locationNameById.set(locId, locationName);
          if (l.client_id != null) {
            const cname = clientNameById.get(Number(l.client_id));
            if (cname) clientNameByLocationId.set(locId, cname);
          }
        }
      } catch (e: any) {
        warnings.push(`locais (parcial): ${e?.message ?? String(e)}`);
      }

      // Upsert de máquinas imediato — mesmo se /products falhar, temos as máquinas
      const machineRows = buildMachineRows(machines, clientNameByLocationId, locationNameById);
      await upsertInChunks("machines", machineRows, "vmpay_machine_id", 500);
      machinesCount = machineRows.length;
      await updateProgress({ machines_count: machinesCount });

      // Fase 3: /products (o mais pesado — pode dar 524)
      try {
        const products = await vmpayFetchPaginated("/products", 50, 200, syncId);
        const productRows = products
          .filter((p: any) => p?.id)
          .map((p: any) => ({
            vmpay_good_id: p.id,
            name: p.name ?? `Produto ${p.id}`,
            description: p.description ?? null,
            upc_code: p.upc_code ?? null,
            barcode: p.barcode ?? null,
            category_id: p.category_id ?? null,
            manufacturer_id: p.manufacturer_id ?? null,
            tags: p.tags ?? null,
          }));
        await upsertInChunks("products", productRows, "vmpay_good_id", 500);
        productsCount = productRows.length;
        await updateProgress({ products_count: productsCount });
      } catch (e: any) {
        warnings.push(`produtos: ${e?.message ?? String(e)}`);
      }

      await updateProgress({
        status: "success",
        machines_count: machinesCount,
        products_count: productsCount,
        error_message: warnings.length ? warnings.join("; ").slice(0, 1000) : null,
        duration_ms: Date.now() - startedAt,
      });

      return { success: true, machinesCount, productsCount, warnings, durationMs: Date.now() - startedAt };
    } catch (err: any) {
      const message = err?.message ?? String(err);
      await updateProgress({
        status: "error",
        machines_count: machinesCount,
        products_count: productsCount,
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
      machineLabel: getMachineLabel(machine),
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

export const listSyncRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sync_logs")
      .select("id, created_at, status, machines_count, products_count, prices_count, duration_ms, error_message")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return { runs: data ?? [] };
  });

export const listSyncEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ syncId: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("sync_log_entries")
      .select("id, sync_id, created_at, endpoint, page, attempt, status_code, ok, duration_ms, error_message")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.syncId) q = q.eq("sync_id", data.syncId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { entries: rows ?? [] };
  });


