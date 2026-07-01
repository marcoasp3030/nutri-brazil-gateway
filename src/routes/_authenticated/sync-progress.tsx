import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getSyncProgress } from "@/lib/vmpay.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sync-progress")({
  head: () => ({ meta: [{ title: "Progresso da sincronização — Nutricar Brasil" }] }),
  component: SyncProgressPage,
});

function fmtDur(ms?: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function fmtDate(v?: string | null) {
  return v ? new Date(v).toLocaleString("pt-BR") : "—";
}

function SyncProgressPage() {
  const fn = useServerFn(getSyncProgress);
  const q = useQuery({
    queryKey: ["sync-progress"],
    queryFn: () => fn({ data: {} }),
    refetchInterval: (query) => {
      const d = query.state.data as any;
      // se está rodando, polling agressivo
      if (d?.run?.status === "running") return 3000;
      return 10000;
    },
  });

  const run = q.data?.run;
  const stats = q.data?.stats ?? [];
  const stale = q.data?.stale;
  const lastEntryAt = q.data?.lastEntryAt;

  const totals = useMemo(() => {
    let req = 0, ok = 0, err = 0, sumMs = 0;
    for (const s of stats) { req += s.requests; ok += s.ok; err += s.errors; sumMs += (s.avg_ms || 0) * s.requests; }
    return { req, ok, err, avg: req ? Math.round(sumMs / req) : 0 };
  }, [stats]);

  const elapsed = run
    ? (run.duration_ms ?? (Date.now() - new Date(run.created_at).getTime()))
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Progresso da última sincronização</CardTitle>
          <CardDescription>
            Atualiza automaticamente a cada 3 segundos enquanto uma sincronização estiver em execução.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!run ? (
            <p className="text-muted-foreground">Nenhuma sincronização registrada ainda.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={run.status} />
                <span className="text-sm text-muted-foreground">
                  Iniciada em <strong>{fmtDate(run.created_at)}</strong>
                </span>
                <span className="text-sm text-muted-foreground">
                  Decorrido: <strong>{fmtDur(elapsed)}</strong>
                </span>
                {lastEntryAt && (
                  <span className="text-sm text-muted-foreground">
                    Última atividade: <strong>{fmtDate(lastEntryAt)}</strong>
                  </span>
                )}
              </div>

              {stale && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Sincronização travada</AlertTitle>
                  <AlertDescription>
                    Sem novas requisições há mais de 90s — o worker provavelmente foi encerrado.
                    Rode uma nova sincronização; ela vai marcar esta como "erro" automaticamente.
                  </AlertDescription>
                </Alert>
              )}

              {run.status === "running" && !stale && (
                <div className="space-y-1">
                  <Progress value={undefined as any} className="h-2" />
                  <p className="text-xs text-muted-foreground">Em execução…</p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Máquinas" value={run.machines_count ?? 0} />
                <Stat label="Produtos" value={run.products_count ?? 0} />
                <Stat label="Requisições VMPay" value={totals.req} />
                <Stat label="Erros" value={totals.err} destructive={totals.err > 0} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Preços no planograma" value={run.prices_count ?? 0} />
                <Stat label="Inseridos" value={run.prices_inserted ?? 0} />
                <Stat label="Atualizados" value={run.prices_updated ?? 0} />
                <Stat label="Ignorados (sem mudança)" value={run.prices_skipped ?? 0} />
              </div>


              {run.error_message && (
                <Alert variant={run.status === "success" ? "default" : "destructive"}>
                  <AlertTitle>{run.status === "success" ? "Avisos" : "Erro"}</AlertTitle>
                  <AlertDescription className="text-xs whitespace-pre-wrap break-all">
                    {run.error_message}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estatísticas por endpoint</CardTitle>
          <CardDescription>
            Páginas processadas, tempo médio/máximo, erros e último erro — para identificar onde está o gargalo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">Requisições</TableHead>
                  <TableHead className="text-right">OK</TableHead>
                  <TableHead className="text-right">Erros</TableHead>
                  <TableHead className="text-right">Páginas</TableHead>
                  <TableHead className="text-right">Última pág.</TableHead>
                  <TableHead className="text-right">Tempo médio</TableHead>
                  <TableHead className="text-right">Tempo máx.</TableHead>
                  <TableHead>Último erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Sem requisições registradas nesta execução.
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.map((s: any) => (
                    <TableRow key={s.endpoint}>
                      <TableCell className="font-mono text-xs">{s.endpoint}</TableCell>
                      <TableCell className="text-right">{s.requests}</TableCell>
                      <TableCell className="text-right">{s.ok}</TableCell>
                      <TableCell className="text-right">
                        {s.errors > 0 ? <Badge variant="destructive">{s.errors}</Badge> : s.errors}
                      </TableCell>
                      <TableCell className="text-right">{s.pages_count}</TableCell>
                      <TableCell className="text-right">{s.max_page ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmtDur(s.avg_ms)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmtDur(s.max_ms)}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-xs text-destructive">
                        {s.last_error ?? ""}
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

function Stat({ label, value, destructive }: { label: string; value: number; destructive?: boolean }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${destructive ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return <Badge variant="secondary">sucesso</Badge>;
  if (status === "running") return <Badge>em execução</Badge>;
  return <Badge variant="destructive">{status}</Badge>;
}
