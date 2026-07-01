import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listPriceChanges } from "@/lib/vmpay.functions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/price-changes")({
  head: () => ({ meta: [{ title: "Alterações de preços — Nutricar Brasil" }] }),
  component: PriceChangesPage,
});

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleString("pt-BR") : "—";

const fmtPrice = (v: any) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const machineLabel = (m: any) => {
  if (!m) return "—";
  return (
    m.location_name ||
    m.place ||
    m.asset_number ||
    (m.vmpay_machine_id != null ? `Máquina ${m.vmpay_machine_id}` : "—")
  );
};

function PriceChangesPage() {
  const listFn = useServerFn(listPriceChanges);
  const [filter, setFilter] = useState<"all" | "inserted" | "updated">("all");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["price-changes", filter],
    queryFn: () =>
      listFn({
        data: {
          changeType: filter === "all" ? undefined : filter,
          limit: 200,
        },
      }),
  });

  const changes = data?.changes ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Alterações de preços</CardTitle>
            <CardDescription>
              Histórico das últimas 200 alterações — preços inseridos e atualizados durante a sincronização de planogramas.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border p-0.5">
              {(["all", "inserted", "updated"] as const).map((k) => (
                <Button
                  key={k}
                  variant={filter === k ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilter(k)}
                >
                  {k === "all" ? "Todos" : k === "inserted" ? "Inseridos" : "Atualizados"}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
          ) : changes.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma alteração registrada ainda. Sincronize o planograma de uma máquina para gerar histórico.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente / Máquina</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Loc.</TableHead>
                    <TableHead className="text-right">Preço anterior</TableHead>
                    <TableHead></TableHead>
                    <TableHead className="text-right">Preço novo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changes.map((c: any) => {
                    const diff =
                      c.old_price != null && c.new_price != null
                        ? Number(c.new_price) - Number(c.old_price)
                        : null;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="whitespace-nowrap">{fmtDate(c.created_at)}</TableCell>
                        <TableCell>
                          <Badge variant={c.change_type === "inserted" ? "secondary" : "default"}>
                            {c.change_type === "inserted" ? "Inserido" : "Atualizado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate">{machineLabel(c.machine)}</TableCell>
                        <TableCell className="max-w-[260px]">
                          <div className="truncate">{c.product?.name ?? "—"}</div>
                          {c.product?.barcode && (
                            <div className="text-xs text-muted-foreground">{c.product.barcode}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.logical_locator ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtPrice(c.old_price)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          <ArrowRight className="h-4 w-4" />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <div>{fmtPrice(c.new_price)}</div>
                          {diff != null && diff !== 0 && (
                            <div className={`text-xs ${diff > 0 ? "text-destructive" : "text-emerald-600"}`}>
                              {diff > 0 ? "+" : ""}
                              {fmtPrice(diff)}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
