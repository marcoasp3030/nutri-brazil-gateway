import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { vmpayFetch, getMachineLabel } from "@/lib/vmpay.functions";

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
//   live?: true,        // true quando o preço veio do planograma atual em tempo real
//   machine: { id, asset_number, client, place, label },
//   product: { name, description, barcode },
//   price: number,
//   balance: number | null,
//   locator: string | null,
//   status: string | null
// }
// Retorno (não encontrado): { found: false, machine?, reason: string }
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
            return Response.json(
              { error: "barcode é obrigatório (mín. 3 caracteres)" },
              { status: 400, headers: corsHeaders },
            );
          }
          if (!machineId && !machineAsset) {
            return Response.json(
              { error: "informe machine_id (uuid) ou machine (asset_number)" },
              { status: 400, headers: corsHeaders },
            );
          }

          // Resolve a máquina (inclui IDs do VMPay para fallback ao vivo)
          let machine: any = null;
          if (machineId) {
            const { data } = await supabaseAdmin
              .from("machines")
              .select("id, asset_number, location_name, place, vmpay_machine_id, installation_id")
              .eq("id", machineId)
              .maybeSingle();
            machine = data;
          } else if (machineAsset) {
            const { data } = await supabaseAdmin
              .from("machines")
              .select("id, asset_number, location_name, place, vmpay_machine_id, installation_id")
              .eq("asset_number", machineAsset)
              .maybeSingle();
            machine = data;
          }

          if (!machine) {
            return Response.json(
              { found: false, reason: "Máquina não encontrada" },
              { status: 404, headers: corsHeaders },
            );
          }

          const machineInfo = {
            id: machine.id,
            asset_number: machine.asset_number,
            client: machine.location_name ?? null,
            place: machine.place ?? null,
            label: getMachineLabel(machine),
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
            return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
          }

          if (!rows || rows.length === 0) {
            // Verifica se o código existe no catálogo local
            const { data: prod } = await supabaseAdmin
              .from("products")
              .select("id, vmpay_good_id, name, barcode, upc_code")
              .or(`barcode.eq.${barcode},upc_code.eq.${barcode}`)
              .limit(1);

            // Fallback ao vivo: consulta o planograma atual direto no VMPay
            if (machine.vmpay_machine_id && machine.installation_id) {
              try {
                const planogram: any = await vmpayFetch(
                  `/machines/${machine.vmpay_machine_id}/installations/${machine.installation_id}/current_planogram`,
                  { logEndpoint: "/machines/:id/installations/:id/current_planogram", retries: 1, timeoutMs: 20000 },
                );
                const items: any[] = planogram?.items ?? [];
                const goodId = prod?.[0]?.vmpay_good_id != null ? Number(prod[0].vmpay_good_id) : null;
                const hit = items.find(
                  (it: any) =>
                    (goodId != null && Number(it?.good_id) === goodId) ||
                    String(it?.barcode ?? "") === barcode ||
                    String(it?.upc_code ?? "") === barcode,
                );
                if (hit) {
                  return Response.json(
                    {
                      found: true,
                      live: true,
                      machine: machineInfo,
                      product: {
                        name: prod?.[0]?.name ?? hit.good_name ?? null,
                        description: prod?.[0]?.description ?? null,
                        barcode: prod?.[0]?.barcode ?? hit.barcode ?? barcode,
                      },
                      price: hit.desired_price != null ? Number(hit.desired_price) : null,
                      balance: hit.current_balance ?? null,
                      locator: hit.logical_locator != null ? String(hit.logical_locator) : null,
                      status: hit.status ?? null,
                    },
                    { headers: corsHeaders },
                  );
                }
              } catch {
                // segue para mensagem padrão abaixo
              }
            }

            return Response.json(
              {
                found: false,
                machine: machineInfo,
                reason:
                  !prod || prod.length === 0
                    ? "Código de barras não encontrado no catálogo"
                    : !machine.installation_id
                      ? "Máquina sem instalação ativa no VMPay"
                      : "Produto não está no planograma desta máquina",
              },
              { status: 200, headers: corsHeaders },
            );
          }

          const row: any = rows[0];
          return Response.json(
            {
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
            },
            { headers: corsHeaders },
          );
        } catch (e: any) {
          return Response.json({ error: e?.message ?? "erro" }, { status: 500, headers: corsHeaders });
        }
      },
    },
  },
});
