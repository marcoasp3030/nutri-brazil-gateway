import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
import { ArrowRight, RefreshCw, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/price-changes")({
  head: () => ({ meta: [{ title: "Alterações de preços — Nutricar Brasil" }] }),
  component: PriceChangesPage,
});

const PAGE_SIZE = 50;

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
  const [newCount, setNewCount] = useState(0);

  const filterArg = filter === "all" ? undefined : filter;

  const infinite = useInfiniteQuery({
    queryKey: ["price-changes", filter],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      listFn({
        data: {
          changeType: filterArg,
          limit: PAGE_SIZE,
          before: pageParam,
        },
      }),
    getNextPageParam: (last: any) => last?.nextCursor ?? undefined,
  });

  const pages = infinite.data?.pages ?? [];
  const changes = useMemo(() => pages.flatMap((p: any) => p.changes ?? []), [pages]);
  const total = (pages[0] as any)?.total ?? null;
  const newestAt = changes[0]?.created_at ?? null;

  // Poll incremental para detectar novas entradas sem recarregar toda a lista
  const { data: newerData } = useQuery({
    queryKey: ["price-changes-newer", filter, newestAt],
    queryFn: () =>
      listFn({
        data: {
          changeType: filterArg,
          limit: 1,
          after: newestAt!,
        },
      }),
    enabled: !!newestAt,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!newerData) return;
    // usa o total quando disponível para saber quantas surgiram
    const n = (newerData as any)?.total ?? ((newerData as any)?.changes?.length ?? 0);
    setNewCount(n);
  }, [newerData]);

  const reloadFromTop = async () => {
    setNewCount(0);
    await infinite.refetch();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Alterações de preços</CardTitle>
            <CardDescription>
              Histórico completo — preços inseridos e atualizados durante a sincronização de planogramas.
              {total != null && (
                <> Mostrando <strong>{changes.length}</strong> de <strong>{total}</strong>.</>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border p-0.5">
              {(["all", "inserted", "updated"] as const).map((k) => (
                <Button
                  key={k}
                  variant={filter === k ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setFilter(k);
                    setNewCount(0);
                  }}
                >
                  {k === "all" ? "Todos" : k === "inserted" ? "Inseridos" : "Atualizados"}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={reloadFromTop} disabled={infinite.isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${infinite.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {newCount > 0 && (
            <div className="mb-3">
              <Button variant="secondary" size="sm" onClick={reloadFromTop} className="w-full">
                <RefreshCw className="h-4 w-4 mr-1" />
                {newCount} nova(s) alteração(ões) — carregar
              </Button>
            </div>
          )}

          {infinite.isLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
          ) : changes.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma alteração registrada ainda. Sincronize o planograma de uma máquina para gerar histórico.
            </div>
          ) : (
            <>
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

              <div className="flex justify-center pt-4">
                {infinite.hasNextPage ? (
                  <Button
                    variant="outline"
                    onClick={() => infinite.fetchNextPage()}
                    disabled={infinite.isFetchingNextPage}
                  >
                    <ChevronDown className={`h-4 w-4 mr-1 ${infinite.isFetchingNextPage ? "animate-bounce" : ""}`} />
                    {infinite.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Fim da lista.</span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
