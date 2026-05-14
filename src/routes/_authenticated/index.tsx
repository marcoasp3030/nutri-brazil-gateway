import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { searchPrices, listMachines, getSyncStats, syncVmpay } from "@/lib/vmpay.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Search, Package, Store, Tag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — Nutricar Brasil" }] }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const searchFn = useServerFn(searchPrices);
  const machinesFn = useServerFn(listMachines);
  const statsFn = useServerFn(getSyncStats);
  const syncFn = useServerFn(syncVmpay);

  const [query, setQuery] = useState("");
  const [machineId, setMachineId] = useState<string>("all");

  const stats = useQuery({ queryKey: ["stats"], queryFn: () => statsFn() });
  const machines = useQuery({ queryKey: ["machines"], queryFn: () => machinesFn() });
  const results = useQuery({
    queryKey: ["search", query, machineId],
    queryFn: () =>
      searchFn({
        data: {
          query: query || undefined,
          machineId: machineId === "all" ? undefined : machineId,
        },
      }),
  });

  const syncMut = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (r: any) => {
      toast.success(
        `Sincronizado: ${r.machinesCount} máquinas, ${r.productsCount} produtos, ${r.pricesCount} preços`,
      );
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(`Erro: ${e?.message ?? "falha"}`),
  });

  const last = stats.data?.lastSync;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={<Package className="h-4 w-4" />} label="Produtos" value={stats.data?.productsCount ?? "—"} />
        <StatCard icon={<Store className="h-4 w-4" />} label="Máquinas" value={stats.data?.machinesCount ?? "—"} />
        <StatCard icon={<Tag className="h-4 w-4" />} label="Preços ativos" value={stats.data?.pricesCount ?? "—"} />
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Última sincronização</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {last
                ? `${new Date(last.created_at).toLocaleString("pt-BR")} — ${last.status}`
                : "Nunca executada"}
            </p>
            <Button
              size="sm"
              className="mt-2 w-full"
              onClick={() => syncMut.mutate()}
              disabled={syncMut.isPending}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncMut.isPending ? "animate-spin" : ""}`} />
              {syncMut.isPending ? "Sincronizando…" : "Sincronizar VMPay"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consulta de preços</CardTitle>
          <CardDescription>
            Busque por nome do produto ou código de barras. Filtre por máquina se desejar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nome do produto ou código de barras"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger className="md:w-64">
                <SelectValue placeholder="Todas as máquinas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as máquinas</SelectItem>
                {machines.data?.machines.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.asset_number ?? `Máquina ${m.vmpay_machine_id}`}
                    {m.place ? ` — ${m.place}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Código de barras</TableHead>
                  <TableHead>Máquina</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Carregando…
                    </TableCell>
                  </TableRow>
                ) : results.data?.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Nenhum resultado. {stats.data?.pricesCount === 0 && "Faça uma sincronização primeiro."}
                    </TableCell>
                  </TableRow>
                ) : (
                  results.data?.items.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.product?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.product?.barcode ?? r.product?.upc_code ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.machine?.asset_number ?? "—"}
                        {r.machine?.place ? ` · ${r.machine.place}` : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {r.desired_price != null
                          ? `R$ ${Number(r.desired_price).toFixed(2)}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API pública para o app</CardTitle>
          <CardDescription>
            Use estes endpoints no aplicativo móvel para consultar preços rapidamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <code className="rounded bg-muted px-2 py-1 text-xs">GET /api/public/prices?barcode=...</code>
          </p>
          <p>
            <code className="rounded bg-muted px-2 py-1 text-xs">GET /api/public/prices?q=NomeDoProduto</code>
          </p>
          <p className="text-muted-foreground">
            Retorna JSON com lista de produtos e preços por máquina.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        {icon}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
