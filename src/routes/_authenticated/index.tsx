import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  searchPrices,
  listMachines,
  getSyncStats,
  syncMachineList,
  syncMachinePlanogram,
  lookupPriceLive,
} from "@/lib/vmpay.functions";
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
import { RefreshCw, Search, Package, Store, Tag, FlaskConical } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — Nutricar Brasil" }] }),
  component: Dashboard,
});

function machineLabel(m: any) {
  return (
    m?.display_name ||
    m?.client_name ||
    m?.location_name ||
    m?.place ||
    m?.asset_number ||
    `Máquina ${m?.vmpay_machine_id ?? ""}`
  );
}

function machineDetail(m: any) {
  const detail = [m?.place, m?.asset_number].filter(Boolean).join(" · ");
  return detail && detail !== machineLabel(m) ? detail : null;
}

function Dashboard() {
  const qc = useQueryClient();
  const searchFn = useServerFn(searchPrices);
  const machinesFn = useServerFn(listMachines);
  const statsFn = useServerFn(getSyncStats);
  const syncListFn = useServerFn(syncMachineList);
  const syncPlanFn = useServerFn(syncMachinePlanogram);
  const lookupFn = useServerFn(lookupPriceLive);

  const [query, setQuery] = useState("");
  const [machineId, setMachineId] = useState<string>("all");
  const [testMachineId, setTestMachineId] = useState<string>("");
  const [liveMachineId, setLiveMachineId] = useState<string>("");
  const [liveBarcode, setLiveBarcode] = useState("");
  const [liveResult, setLiveResult] = useState<any>(null);

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

  const syncListMut = useMutation({
    mutationFn: () => syncListFn(),
    onSuccess: (r: any) => {
      toast.success(`Lista atualizada: ${r.machinesCount} máquinas, ${r.productsCount} produtos`);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(`Erro: ${e?.message ?? "falha"}`),
  });

  const syncPlanMut = useMutation({
    mutationFn: (id: string) => syncPlanFn({ data: { machineId: id } }),
    onSuccess: (r: any) => {
      toast.success(`${r.machineLabel}: ${r.pricesCount} preços sincronizados`);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(`Erro: ${e?.message ?? "falha"}`),
  });

  const lookupMut = useMutation({
    mutationFn: (input: { machineId: string; barcode: string }) =>
      lookupFn({ data: input }),
    onSuccess: (r: any) => setLiveResult(r),
    onError: (e: any) => {
      setLiveResult(null);
      toast.error(`Erro: ${e?.message ?? "falha"}`);
    },
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
              onClick={() => syncListMut.mutate()}
              disabled={syncListMut.isPending}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncListMut.isPending ? "animate-spin" : ""}`} />
              {syncListMut.isPending ? "Atualizando…" : "Atualizar lista"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consultar preço por código de barras</CardTitle>
          <CardDescription>
            Selecione o cliente/máquina e informe o código de barras. Consulta direta no banco — resposta instantânea. Sincronize a máquina antes para gravar os preços.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row">
            <Select value={liveMachineId} onValueChange={setLiveMachineId}>
              <SelectTrigger className="md:w-72">
                <SelectValue placeholder="Selecione um cliente / máquina" />
              </SelectTrigger>
              <SelectContent>
                {machines.data?.machines.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    {machineLabel(m)}{machineDetail(m) ? ` · ${machineDetail(m)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Código de barras"
              value={liveBarcode}
              onChange={(e) => setLiveBarcode(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() =>
                liveMachineId &&
                liveBarcode.trim() &&
                lookupMut.mutate({ machineId: liveMachineId, barcode: liveBarcode.trim() })
              }
              disabled={!liveMachineId || !liveBarcode.trim() || lookupMut.isPending}
            >
              <Search className={`mr-2 h-4 w-4 ${lookupMut.isPending ? "animate-pulse" : ""}`} />
              {lookupMut.isPending ? "Consultando…" : "Consultar"}
            </Button>
          </div>
          {liveResult && (
            <div className="rounded-md border p-4 text-sm">
              <p className="text-xs text-muted-foreground">{liveResult.machineLabel}</p>
              {liveResult.found ? (
                <>
                  <p className="font-medium">{liveResult.product?.name}</p>
                  <p className="mt-1 text-2xl font-bold">
                    {liveResult.price != null
                      ? `R$ ${Number(liveResult.price).toFixed(2)}`
                      : "Sem preço"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Locator: {liveResult.locator ?? "—"} · Saldo:{" "}
                    {liveResult.balance ?? "—"} · Status: {liveResult.status ?? "—"}
                  </p>
                </>
              ) : (
                <p className="text-destructive">{liveResult.reason}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testar uma máquina</CardTitle>
          <CardDescription>
            Escolha um cliente para buscar o planograma atual e gravar os preços apenas dessa máquina.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 md:flex-row">
            <Select value={testMachineId} onValueChange={setTestMachineId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um cliente / máquina" />
              </SelectTrigger>
              <SelectContent>
                {machines.data?.machines.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    {machineLabel(m)}{machineDetail(m) ? ` · ${machineDetail(m)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => testMachineId && syncPlanMut.mutate(testMachineId)}
              disabled={!testMachineId || syncPlanMut.isPending}
            >
              <FlaskConical className={`mr-2 h-4 w-4 ${syncPlanMut.isPending ? "animate-pulse" : ""}`} />
              {syncPlanMut.isPending ? "Buscando…" : "Sincronizar preços desta máquina"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consulta de preços</CardTitle>
          <CardDescription>
            Busque por nome do produto ou código de barras. Filtre pelo cliente se desejar.
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
              <SelectTrigger className="md:w-72">
                <SelectValue placeholder="Todos os clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {machines.data?.machines.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    {machineLabel(m)}{machineDetail(m) ? ` · ${machineDetail(m)}` : ""}
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
                  <TableHead>Cliente</TableHead>
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
                      Nenhum resultado.{" "}
                      {stats.data?.pricesCount === 0 && "Sincronize uma máquina primeiro."}
                    </TableCell>
                  </TableRow>
                ) : (
                  results.data?.items.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.product?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.product?.barcode ?? r.product?.upc_code ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">{machineLabel(r.machine)}</TableCell>
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
