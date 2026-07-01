import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { RefreshCw, Search, Package, Store, Tag, FlaskConical, ChevronsUpDown, Check } from "lucide-react";
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
  const detail = [m?.place && m.place !== m?.location_name ? m.place : null, m?.asset_number]
    .filter(Boolean)
    .join(" · ");
  return detail && detail !== machineLabel(m) ? detail : null;
}

function MachineCombobox({
  machines,
  value,
  onChange,
  placeholder,
  allLabel,
  className,
}: {
  machines: any[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  allLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value === "all" ? null : machines.find((m) => m.id === value);
  const selectedLabel = value === "all" ? allLabel : selected ? machineLabel(selected) : "";
  const items = useMemo(
    () =>
      machines.map((m) => {
        const label = machineLabel(m);
        const detail = machineDetail(m);
        return {
          machine: m,
          label,
          detail,
          search: [label, detail, m?.asset_number, m?.vmpay_machine_id].filter(Boolean).join(" "),
        };
      }),
    [machines],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between overflow-hidden", className)}
        >
          <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>
            {selectedLabel || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Digite o nome do cliente, local ou máquina..." />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup>
              {allLabel && (
                <CommandItem
                  value={allLabel}
                  onSelect={() => {
                    onChange("all");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} />
                  {allLabel}
                </CommandItem>
              )}
              {items.map(({ machine, label, detail, search }) => (
                <CommandItem
                  key={machine.id}
                  value={search}
                  onSelect={() => {
                    onChange(machine.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === machine.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{label}</span>
                    {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function MachineMultiSelect({
  machines,
  selected,
  onChange,
}: {
  machines: any[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(selected);
  const items = useMemo(
    () =>
      machines.map((m) => {
        const label = machineLabel(m);
        const detail = machineDetail(m);
        return {
          machine: m,
          label,
          detail,
          search: [label, detail, m?.asset_number, m?.vmpay_machine_id].filter(Boolean).join(" "),
        };
      }),
    [machines],
  );
  const summary =
    selected.length === 0
      ? "Selecione um ou mais clientes / máquinas"
      : `${selected.length} selecionada(s)`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="flex-1 justify-between overflow-hidden">
          <span className={cn("truncate", selected.length === 0 && "text-muted-foreground")}>{summary}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Digite para filtrar..." />
          <div className="flex justify-between border-b px-2 py-1 text-xs">
            <button className="text-primary hover:underline" onClick={() => onChange(items.map((i) => i.machine.id))}>
              Selecionar todos
            </button>
            <button className="text-muted-foreground hover:underline" onClick={() => onChange([])}>
              Limpar
            </button>
          </div>
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup>
              {items.map(({ machine, label, detail, search }) => {
                const checked = selectedSet.has(machine.id);
                return (
                  <CommandItem
                    key={machine.id}
                    value={search}
                    onSelect={() => {
                      const next = new Set(selectedSet);
                      if (checked) next.delete(machine.id);
                      else next.add(machine.id);
                      onChange(Array.from(next));
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{label}</span>
                      {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
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
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; current?: string } | null>(null);

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
      if (r.warnings?.length) toast.warning(`Sincronização concluída com aviso: ${r.warnings.join("; ")}`);
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
            <MachineCombobox
              machines={machines.data?.machines ?? []}
              value={liveMachineId}
              onChange={setLiveMachineId}
              placeholder="Selecione um cliente / máquina"
              className="md:w-96"
            />
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
            <MachineCombobox
              machines={machines.data?.machines ?? []}
              value={testMachineId}
              onChange={setTestMachineId}
              placeholder="Digite para localizar o cliente / máquina"
              className="flex-1"
            />
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
          <CardTitle>Sincronizar preços em lote</CardTitle>
          <CardDescription>
            Selecione quais clientes/máquinas devem ter os preços atualizados de uma vez para pré-aquecer o cache.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row">
            <MachineMultiSelect
              machines={machines.data?.machines ?? []}
              selected={bulkSelected}
              onChange={setBulkSelected}
            />
            <Button
              onClick={async () => {
                if (bulkSelected.length === 0) return;
                setBulkProgress({ done: 0, total: bulkSelected.length });
                let ok = 0;
                let fail = 0;
                for (let i = 0; i < bulkSelected.length; i++) {
                  const id = bulkSelected[i];
                  const m = (machines.data?.machines ?? []).find((x: any) => x.id === id);
                  setBulkProgress({ done: i, total: bulkSelected.length, current: m ? machineLabel(m) : undefined });
                  try {
                    await syncPlanFn({ data: { machineId: id } });
                    ok++;
                  } catch (e: any) {
                    fail++;
                    toast.error(`${m ? machineLabel(m) : id}: ${e?.message ?? "falha"}`);
                  }
                }
                setBulkProgress({ done: bulkSelected.length, total: bulkSelected.length });
                toast.success(`Concluído: ${ok} sucesso(s), ${fail} falha(s)`);
                qc.invalidateQueries();
                setTimeout(() => setBulkProgress(null), 4000);
              }}
              disabled={bulkSelected.length === 0 || (bulkProgress != null && bulkProgress.done < bulkProgress.total)}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${bulkProgress && bulkProgress.done < bulkProgress.total ? "animate-spin" : ""}`} />
              {bulkProgress && bulkProgress.done < bulkProgress.total
                ? `Sincronizando ${bulkProgress.done + 1}/${bulkProgress.total}…`
                : `Sincronizar ${bulkSelected.length || ""} selecionada(s)`}
            </Button>
          </div>
          {bulkProgress && (
            <div className="space-y-1 text-sm">
              <div className="h-2 w-full overflow-hidden rounded bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {bulkProgress.done}/{bulkProgress.total}
                {bulkProgress.current && bulkProgress.done < bulkProgress.total ? ` — ${bulkProgress.current}` : ""}
              </p>
            </div>
          )}
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
            <MachineCombobox
              machines={machines.data?.machines ?? []}
              value={machineId}
              onChange={setMachineId}
              placeholder="Todos os clientes"
              allLabel="Todos os clientes"
              className="md:w-96"
            />
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
