import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const Route = createFileRoute("/api/public/prices")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const barcode = url.searchParams.get("barcode")?.trim();
          const q = url.searchParams.get("q")?.trim();
          const machineAsset = url.searchParams.get("machine")?.trim();
          const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);

          let productIds: string[] | null = null;

          if (barcode) {
            const { data } = await supabaseAdmin
              .from("products")
              .select("id")
              .or(`barcode.eq.${barcode},upc_code.eq.${barcode}`)
              .limit(50);
            productIds = (data ?? []).map((p) => p.id);
            if (productIds.length === 0) {
              return new Response(JSON.stringify({ items: [] }), { headers: corsHeaders });
            }
          } else if (q) {
            if (q.length < 2) {
              return new Response(
                JSON.stringify({ error: "q deve ter ao menos 2 caracteres" }),
                { status: 400, headers: corsHeaders },
              );
            }
            const { data } = await supabaseAdmin
              .from("products")
              .select("id")
              .ilike("name", `%${q}%`)
              .limit(50);
            productIds = (data ?? []).map((p) => p.id);
            if (productIds.length === 0) {
              return new Response(JSON.stringify({ items: [] }), { headers: corsHeaders });
            }
          }

          let query = supabaseAdmin
            .from("machine_products")
            .select(
              "desired_price, logical_locator, current_balance, status, machine:machines(asset_number, place), product:products(name, description, barcode, upc_code)",
            )
            .not("desired_price", "is", null)
            .order("desired_price", { ascending: true })
            .limit(limit);

          if (productIds) query = query.in("product_id", productIds);
          if (machineAsset) {
            const { data: m } = await supabaseAdmin
              .from("machines")
              .select("id")
              .eq("asset_number", machineAsset)
              .maybeSingle();
            if (m) query = query.eq("machine_id", m.id);
          }

          const { data, error } = await query;
          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: corsHeaders,
            });
          }

          return new Response(
            JSON.stringify({
              items: (data ?? []).map((r: any) => ({
                product: r.product?.name,
                barcode: r.product?.barcode ?? r.product?.upc_code,
                description: r.product?.description,
                machine: r.machine?.asset_number,
                location: r.machine?.place,
                price: r.desired_price != null ? Number(r.desired_price) : null,
                balance: r.current_balance,
                status: r.status,
              })),
            }),
            { headers: corsHeaders },
          );
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e?.message ?? "erro" }), {
            status: 500,
            headers: corsHeaders,
          });
        }
      },
    },
  },
});
