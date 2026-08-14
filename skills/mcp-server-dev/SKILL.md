---
name: mcp-server-dev
description: "Desenvolvimento de servidores MCP: tools com schema Zod, resources, prompts, transportes STDIO/HTTP e sanitização contra path-traversal e command injection. Use ao criar ou estender servidores MCP."
---

# Model Context Protocol (MCP) Server Development

Guia de produção para criar servidores MCP compatíveis com a especificação (Anthropic/open standards): expõe **Tools**, **Resources** e **Prompts** para assistentes de IA de forma segura, robusta e bem documentada.

## Quando usar

Use ao: criar servidor MCP novo (ex: expor dados do framework, ferramentas de automação), adicionar tools/resources a servidor existente, migrar ferramenta CLI para MCP, ou revisar servidor MCP quanto a segurança/robustez. **Pule** para: integração de app comum via REST (skill `api-automation`), plugins de CLI específicos, ou quando o usuário só quer CONSUMIR um servidor MCP existente.

## Conceitos essenciais (o que o servidor expõe)

| Tipo | O que é | Exemplo |
|---|---|---|
| **Tool** | Função executável com schema JSON Schema estrito | `buscar_cliente(cpf: string)` |
| **Resource** | Dado contextual exposto via URI (`file:///`, `custom://`) | `file:///docs/arquitetura.md` |
| **Prompt** | Template de instrução pré-configurado reutilizável | `revisar-pr` com placeholders |

## Stack de implementação (TypeScript padrão)

- **SDK**: `@modelcontextprotocol/sdk` (TypeScript oficial, tipos completos)
- **Validação**: `zod` + `zod-to-json-schema` (schema derivado, nunca duplicado à mão)
- **Transportes**: STDIO (padrão para agentes locais) e HTTP/SSE streamable (remoto)
- **Teste/inspeção**: `npx @modelcontextprotocol/inspector` (UI de teste) + testes de integração

## Workflow de desenvolvimento (6 passos)

### Passo 1 — Escopo das tools (comece pequeno)

- Liste as operações que o agente precisa — **cada tool = uma responsabilidade** (nada de "tool faz-tudo").
- Nomeie com verbo + objeto (`list_repos`, `read_file`, `run_build`).
- **Descrição rica para o LLM** (é o que o modelo usa para decidir quando chamar): inclua quando usar, quando NÃO usar, formato esperado de retorno, efeitos colaterais.

### Passo 2 — Schemas estritos (nunca confie no input)

```ts
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const InputSchema = z.object({
  cpf: z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos"),
  incluir_historico: z.boolean().optional().default(false),
});
```

- Valide **todos** os parâmetros obrigatórios e opcionais; defina defaults explícitos.
- Tipos estritos (regex, enum, min/max) — o agente pode mandar qualquer string.
- **Nunca** aceite caminhos de arquivo ou comandos sem sanitização (ver Passo 4).

### Passo 3 — Implemente a tool com erro estruturado

```ts
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    const args = InputSchema.parse(req.params.arguments);
    const resultado = await buscarCliente(args.cpf);
    return {
      content: [{ type: "text", text: JSON.stringify(resultado) }],
    };
  } catch (err) {
    return {
      isError: true,  // OBRIGATÓRIO para o agente saber que falhou
      content: [{ type: "text", text: `Erro: ${mensagemClara(err)}` }],
    };
  }
});
```

- Erro **nunca derruba o processo** STDIO/SSE — tudo vira `{ isError: true, content: [...] }`.
- Mensagem clara e acionável (não `undefined`), sem stack trace gigante.
- Log de erro no servidor (stderr) para o humano; resposta limpa para o agente.

### Passo 4 — Sanitização obrigatória (segurança)

- **Command injection**: nunca concatene input em shell — use `execFile` com array de args (sem shell) ou biblioteca de parsing.
- **Path traversal**: normalize e valide que o caminho resolvido fica DENTRO do diretório permitido:

```ts
import path from "node:path";

function safeResolve(base: string, userPath: string): string {
  const resolved = path.resolve(base, userPath);
  if (!resolved.startsWith(path.resolve(base))) {
    throw new Error("Caminho fora do diretório permitido");
  }
  return resolved;
}
```

- **SSRF**: resources que buscam URLs — valide protocolo (só `http(s)`), bloqueie IPs privados/loopback se não for o caso de uso.
- **Input do agente é hostil por padrão**: o agente pode ter sido induzido por prompt injection a chamar tools com args maliciosos.

### Passo 5 — Transportes (STDIO + HTTP/SSE)

```ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// STDIO (local, padrão)
const stdio = new StdioServerTransport();
await server.connect(stdio);

// HTTP/SSE (remoto) — exponha endpoints /mcp (POST) e /mcp (GET/SSE)
```

- STDIO para agentes locais (opencode, Claude Code...); HTTP para servidores remotos multi-cliente.
- Valide `Authorization` header no HTTP (bearer token) se o servidor expor dados sensíveis.
- Cuide de timeouts/reconexão no SSE; documente o modelo de transporte no README.

### Passo 6 — Teste e documente

- **MCP Inspector**: `npx @modelcontextprotocol/inspector node dist/server.js` — valide cada tool com inputs válidos E inválidos.
- Testes de integração: chame o servidor via SDK client em testes automatizados.
- Documente: lista de tools com exemplos de uso, resources com URIs, transporte e como configurar no cliente (`claude_desktop_config.json`, `opencode.json` mcp section).

## Checklist de qualidade (antes de entregar)

- [ ] Tools com descrições claras e detalhadas (o LLM sabe QUANDO chamar)
- [ ] Schemas validam todos os parâmetros (obrigatórios e opcionais)
- [ ] Erros retornam `{ isError: true, content: [...] }` — processo nunca morre
- [ ] Sanitização em TODO argumento de arquivo/comando (path traversal + injection)
- [ ] Validação de auth no transporte HTTP (se remoto)
- [ ] Testado com MCP Inspector (casos válidos e inválidos)
- [ ] README com setup, tools, resources e exemplo de configuração no cliente
- [ ] Sem segredos no código (`.env` — ver skill `automation-security`)

## Anti-padrões (proibido)

1. ❌ Tool que executa shell com input concatenado (`exec(`user ${input}`)`)
2. ❌ Caminho de arquivo do agente sem `safeResolve` (path traversal)
3. ❌ Erro não estruturado que derruba o processo STDIO
4. ❌ Schema na mão (JSON Schema duplicado) em vez de `zod-to-json-schema` — divergem
5. ❌ Tool com descrição vaga ("faz coisas") — o LLM nunca chama na hora certa
6. ❌ Expor recurso sensível sem auth no transporte HTTP
7. ❌ Response gigante sem paginação/limite (estoura contexto do agente)
8. ❌ Ignorar `isError` no retorno (agente acha que funcionou)

## Composição com outras skills

- **Antes**: `automation-research` (spec MCP, SDK atual) → `automation-planning` (escopo das tools)
- **Depois**: `automation-security` (auth/segredos) → `testing-automation` (testes de integração) → `automation-documentation` (README) → `ai-agent` (consumo do MCP pelo agente)

## References

- Spec MCP: https://modelcontextprotocol.io · SDK TypeScript: https://github.com/modelcontextprotocol/typescript-sdk · zod: https://zod.dev · MCP Inspector: https://github.com/modelcontextprotocol/inspector
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
