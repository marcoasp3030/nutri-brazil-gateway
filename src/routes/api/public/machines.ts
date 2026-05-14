import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// GET /api/public/machines
// Lista as máquinas/lojas disponíveis para o app salvar localmente.
// Resposta: [{ id, asset_number, client, place, label }]
export const Route = createFileRoute("/api/public/machines")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const q = url.searchParams.get("q")?.trim().toLowerCase();

          let query = supabaseAdmin
            .from("machines")
            .select("id, asset_number, location_name, place")
            .order("location_name", { nullsFirst: false })
            .order("place", { nullsFirst: false })
            .order("asset_number", { nullsFirst: false })
            .limit(2000);

          const { data, error } = await query;
          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: corsHeaders,
            });
          }

          let items = (data ?? []).map((m: any) => {
            const client = m.location_name ?? null;
            const place = m.place ?? null;
            const asset = m.asset_number ?? null;
            const label = [client, place, asset].filter(Boolean).join(" · ") || `Máquina ${m.id.slice(0, 8)}`;
            return {
              id: m.id,
              asset_number: asset,
              client,
              place,
              label,
            };
          });

          if (q) {
            items = items.filter((it) =>
              `${it.client ?? ""} ${it.place ?? ""} ${it.asset_number ?? ""}`
                .toLowerCase()
                .includes(q),
            );
          }

          return new Response(JSON.stringify({ items }), { headers: corsHeaders });
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
