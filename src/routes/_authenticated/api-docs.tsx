import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/api-docs")({
  head: () => ({ meta: [{ title: "Documentação da API — Nutricar Brasil" }] }),
  component: ApiDocs,
});

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copiado");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative">
      <pre className="bg-muted text-muted-foreground rounded-md p-3 text-xs overflow-x-auto">
        <code>{code}</code>
      </pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-1 right-1 h-7 w-7"
        onClick={copy}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );
}

function ApiDocs() {
  const [base, setBase] = useState("");
  useEffect(() => {
    setBase(window.location.origin);
  }, []);

  const machinesUrl = `${base}/api/public/machines`;
  const lookupUrl = `${base}/api/public/lookup`;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Documentação da API</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Endpoints públicos para integração com o app de leitura de código de barras.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardDescription>Base URL</CardDescription>
          <CardTitle className="font-mono text-base break-all">{base || "—"}</CardTitle>
        </CardHeader>
      </Card>

      {/* Machines */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge>GET</Badge>
            <CardTitle className="font-mono text-base">/api/public/machines</CardTitle>
          </div>
          <CardDescription>
            Lista as lojas/máquinas disponíveis. Use no app para o usuário selecionar a loja e
            salvar o <code className="font-mono">id</code> localmente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-2">Parâmetros (query)</h4>
            <ul className="text-sm text-muted-foreground list-disc pl-5">
              <li>
                <code className="font-mono">q</code> — opcional. Filtra por nome do cliente, local
                ou número de patrimônio.
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2">Exemplo de requisição</h4>
            <CodeBlock code={`curl "${machinesUrl}?q=condominio"`} />
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2">Exemplo de resposta (200)</h4>
            <CodeBlock
              code={`[
  {
    "id": "uuid-da-maquina",
    "asset_number": "VM-001",
    "client": "Condomínio Kasa Klabin",
    "place": "Hall de entrada",
    "label": "Condomínio Kasa Klabin · Hall de entrada · VM-001"
  }
]`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lookup */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge>GET</Badge>
            <CardTitle className="font-mono text-base">/api/public/lookup</CardTitle>
          </div>
          <CardDescription>
            Recebe o código de barras lido pelo app e retorna a descrição do produto e o preço
            cadastrado para a loja selecionada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-2">Parâmetros (query)</h4>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>
                <code className="font-mono">machine_id</code> — uuid da máquina (retornado em{" "}
                <code className="font-mono">/machines</code>). <strong>Obrigatório</strong> (ou{" "}
                <code className="font-mono">machine</code>).
              </li>
              <li>
                <code className="font-mono">machine</code> — alternativa: número de patrimônio
                (asset_number).
              </li>
              <li>
                <code className="font-mono">barcode</code> — código de barras lido. Mínimo 3
                caracteres. <strong>Obrigatório</strong>.
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2">Exemplo de requisição</h4>
            <CodeBlock
              code={`curl "${lookupUrl}?machine_id=UUID_DA_LOJA&barcode=7891234567890"`}
            />
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2">Resposta — produto encontrado (200)</h4>
            <CodeBlock
              code={`{
  "found": true,
  "machine": {
    "id": "uuid",
    "asset_number": "VM-001",
    "client": "Condomínio Kasa Klabin",
    "place": "Hall",
    "label": "Condomínio Kasa Klabin · Hall · VM-001"
  },
  "product": {
    "name": "Coca-Cola 350ml",
    "description": "Refrigerante lata",
    "barcode": "7891234567890"
  },
  "price": 6.50,
  "balance": 12,
  "locator": "A1",
  "status": "ok"
}`}
            />
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2">Resposta — não encontrado (200)</h4>
            <CodeBlock
              code={`{
  "found": false,
  "machine": { "id": "uuid", "label": "..." },
  "reason": "Produto não está no planograma desta máquina"
}`}
            />
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2">Erros</h4>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>
                <code className="font-mono">400</code> — parâmetros faltando ou inválidos.
              </li>
              <li>
                <code className="font-mono">404</code> — máquina não encontrada.
              </li>
              <li>
                <code className="font-mono">500</code> — erro interno.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Fluxo no app */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fluxo recomendado no app</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="text-sm list-decimal pl-5 space-y-2">
            <li>
              Tela de configuração: chamar <code className="font-mono">/api/public/machines</code>,
              exibir a lista para o usuário e salvar o <code className="font-mono">id</code>{" "}
              escolhido no armazenamento local.
            </li>
            <li>
              Tela de leitura: ao escanear o código, chamar{" "}
              <code className="font-mono">/api/public/lookup?machine_id=...&barcode=...</code> e
              exibir <code className="font-mono">product.name</code> e{" "}
              <code className="font-mono">price</code>.
            </li>
            <li>
              Resposta vem direto do banco — instantânea. Lembre de sincronizar a máquina no painel
              para que os preços fiquem disponíveis.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
