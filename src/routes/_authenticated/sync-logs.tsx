import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listSyncRuns, listSyncEntries } from "@/lib/vmpay.functions";
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

export const Route = createFileRoute("/_authenticated/sync-logs")({
  head: () => ({ meta: [{ title: "Logs de sincronização — Nutricar Brasil" }] }),
  component: SyncLogsPage,
});

function fmtDate(v?: string | null) {
  return v ? new Date(v).toLocaleString("pt-BR") : "—";
}
function fmtDur(ms?: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function SyncLogsPage() {
  const runsFn = useServerFn(listSyncRuns);
  const entriesFn = useServerFn(listSyncEntries);
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const runs = useQuery({ queryKey: ["sync-runs"], queryFn: () => runsFn() });
  const entries = useQuery({
    queryKey: ["sync-entries", selected ?? "all"],
    queryFn: () => entriesFn({ data: { syncId: selected } }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Execuções de sincronização</CardTitle>
            <CardDescription>
              Histórico das últimas 30 execuções. Clique em uma linha para ver as requisições detalhadas.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              runs.refetch();
              entries.refetch();
            }}
          >
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Produtos</TableHead>
                  <TableHead className="text-right">Máquinas</TableHead>
                  <TableHead className="text-right">Duração</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.data?.runs.map((r: any) => (
                  <TableRow
                    key={r.id}
                    className={`cursor-pointer ${selected === r.id ? "bg-muted" : ""}`}
                    onClick={() => setSelected(selected === r.id ? undefined : r.id)}
                  >
                    <TableCell className="text-xs">{fmtDate(r.created_at)}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-right">{r.products_count ?? 0}</TableCell>
                    <TableCell className="text-right">{r.machines_count ?? 0}</TableCell>
                    <TableCell className="text-right">{fmtDur(r.duration_ms)}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-xs text-destructive">
                      {r.error_message ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {runs.data?.runs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhuma execução registrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Requisições {selected ? "da execução selecionada" : "recentes (todas)"}
          </CardTitle>
          <CardDescription>
            Data/hora, endpoint, página, tentativa, código HTTP, tempo de resposta e erro.
            {selected && (
              <Button variant="link" size="sm" onClick={() => setSelected(undefined)}>
                limpar filtro
              </Button>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">Página</TableHead>
                  <TableHead className="text-right">Tent.</TableHead>
                  <TableHead className="text-right">HTTP</TableHead>
                  <TableHead className="text-right">Tempo</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Carregando…
                    </TableCell>
                  </TableRow>
                ) : entries.data?.entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nenhuma requisição registrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.data?.entries.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{fmtDate(e.created_at)}</TableCell>
                      <TableCell className="font-mono text-xs">{e.endpoint}</TableCell>
                      <TableCell className="text-right">{e.page ?? "—"}</TableCell>
                      <TableCell className="text-right">{e.attempt}</TableCell>
                      <TableCell className="text-right">
                        {e.status_code ? (
                          <Badge variant={e.ok ? "secondary" : "destructive"}>
                            {e.status_code}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">ERR</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {fmtDur(e.duration_ms)}
                      </TableCell>
                      <TableCell className="max-w-[320px] truncate text-xs text-destructive">
                        {e.error_message ?? ""}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return <Badge variant="secondary">sucesso</Badge>;
  if (status === "running") return <Badge>em execução</Badge>;
  return <Badge variant="destructive">{status}</Badge>;
}
