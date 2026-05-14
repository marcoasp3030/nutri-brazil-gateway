import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// GET /api/public/lookup?machine_id=<uuid>&barcode=<code>
// Também aceita ?machine=<asset_number>&barcode=<code> como alternativa.
// Retorno (encontrado):
// {
//   found: true,
//   machine: { id, asset_number, client, place, label },
//   product: { name, description, barcode },
//   price: number,
//   balance: number | null,
//   locator: string | null,
//   status: string | null
// }
// Retorno (não encontrado): { found: false, reason: string }
export const Route = createFileRoute("/api/public/lookup")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const machineId = url.searchParams.get("machine_id")?.trim();
          const machineAsset = url.searchParams.get("machine")?.trim();
          const barcode = url.searchParams.get("barcode")?.trim();

          if (!barcode || barcode.length < 3) {
            return new Response(
              JSON.stringify({ error: "barcode é obrigatório (mín. 3 caracteres)" }),
              { status: 400, headers: corsHeaders },
            );
          }
          if (!machineId && !machineAsset) {
            return new Response(
              JSON.stringify({ error: "informe machine_id (uuid) ou machine (asset_number)" }),
              { status: 400, headers: corsHeaders },
            );
          }

          // Resolve a máquina
          let machine: any = null;
          if (machineId) {
            const { data } = await supabaseAdmin
              .from("machines")
              .select("id, asset_number, location_name, place")
              .eq("id", machineId)
              .maybeSingle();
            machine = data;
          } else if (machineAsset) {
            const { data } = await supabaseAdmin
              .from("machines")
              .select("id, asset_number, location_name, place")
              .eq("asset_number", machineAsset)
              .maybeSingle();
            machine = data;
          }

          if (!machine) {
            return new Response(
              JSON.stringify({ found: false, reason: "Máquina não encontrada" }),
              { status: 404, headers: corsHeaders },
            );
          }

          const machineInfo = {
            id: machine.id,
            asset_number: machine.asset_number,
            client: machine.location_name ?? null,
            place: machine.place ?? null,
            label:
              [machine.location_name, machine.place, machine.asset_number]
                .filter(Boolean)
                .join(" · ") || `Máquina ${machine.id.slice(0, 8)}`,
          };

          // Consulta direta no banco — JOIN com produto, filtra por barcode/upc
          const { data: rows, error } = await supabaseAdmin
            .from("machine_products")
            .select(
              "desired_price, current_balance, status, logical_locator, product:products!inner(name, description, barcode, upc_code)",
            )
            .eq("machine_id", machine.id)
            .or(`barcode.eq.${barcode},upc_code.eq.${barcode}`, { foreignTable: "products" })
            .limit(1);

          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: corsHeaders,
            });
          }

          if (!rows || rows.length === 0) {
            // Diferenciar mensagem: catálogo x planograma
            const { data: prod } = await supabaseAdmin
              .from("products")
              .select("id")
              .or(`barcode.eq.${barcode},upc_code.eq.${barcode}`)
              .limit(1);

            return new Response(
              JSON.stringify({
                found: false,
                machine: machineInfo,
                reason:
                  !prod || prod.length === 0
                    ? "Código de barras não encontrado no catálogo"
                    : "Produto não está no planograma desta máquina",
              }),
              { status: 200, headers: corsHeaders },
            );
          }

          const row: any = rows[0];
          return new Response(
            JSON.stringify({
              found: true,
              machine: machineInfo,
              product: {
                name: row.product?.name ?? null,
                description: row.product?.description ?? null,
                barcode: row.product?.barcode ?? row.product?.upc_code ?? barcode,
              },
              price: row.desired_price != null ? Number(row.desired_price) : null,
              balance: row.current_balance,
              locator: row.logical_locator,
              status: row.status,
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
