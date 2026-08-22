---
name: "wasm"
description: "Compila código para WebAssembly (Rust/AssemblyScript) e integra com JS para performance quase nativa no browser. Use ao implementar processamento pesado no client (imagem, áudio, cálculos, compressão). Gatilhos de ativação: skill webassembly — izanagi; o que e webassembly; casos de uso no izanagi; rust + wasm (preferido)."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Skill WebAssembly — Izanagi

> Migrado deterministicamente de `skills/wasm/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Compila código para WebAssembly (Rust/AssemblyScript) e integra com JS para performance quase nativa no browser.
- **Ativar quando:** Use ao implementar processamento pesado no client (imagem, áudio, cálculos, compressão).
- **Escopo canônico:** Skill WebAssembly — Izanagi
- **Seções do corpo original:** O Que e WebAssembly · Casos de Uso no Izanagi · Rust + Wasm (Preferido) · AssemblyScript (TypeScript-like) · Performance
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: sections-as-steps -->

### Passo 1 — Aplicar: O Que e WebAssembly

- **Formato binario** de baixo nivel para execucao no browser
- **Compilavel** de C/C++, Rust, Go, Kotlin, AssemblyScript
- **Performance** proxima a nativa (nao e interpretado como JS)
- **Sandbox**: executa no mesmo ambiente seguro que JS
- **Modules**: import/export de funcoes entre Wasm e JS

---

### Passo 2 — Aplicar: Casos de Uso no Izanagi

| Caso | Descricao | Linguagem |
|------|-----------|-----------|
| Processamento de imagens | Redimensionar no client | Rust |
| PDF generation | Gerar PDF no client | Rust / C++ |
| Audio processing | Editar audio da radio | C++ (FFmpeg) |
| Data compression | Comprimir/decomprimir dados | Rust |
| Complex calculations | Calculos atuariais (INSS) | Rust |
| Video transcoding | Codificar video para streaming | C++ (libav) |

---

### Passo 3 — Aplicar: Setup

```bash
# Instalar target
rustup target add wasm32-unknown-unknown
# Build tool
cargo install wasm-pack
```

### Passo 4 — Aplicar: Projeto

```rust
// src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn calculate_benefit(salary: f64, years: f64) -> f64 {
    salary * years * 0.015
}

#[wasm_bindgen]
pub fn validate_cpf(cpf: &str) -> bool {
    // Validacao de CPF em Rust
}
```

```bash
wasm-pack build --target web
```

### Passo 5 — Aplicar: Uso no Frontend

```tsx
import init, { calculate_benefit } from "@/wasm/core";

await init(); // inicializa o modulo wasm
const result = calculate_benefit(5000, 30);
```

---

### Passo 6 — Aplicar: AssemblyScript (TypeScript-like)

```typescript
// assembly/index.ts
export function fibonacci(n: i32): i32 {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
```

- Sintaxe similar ao TypeScript (curva de aprendizado baixa)
- Performance inferior ao Rust, mas superior ao JS
- Bom para casos simples de migracao

---

### Passo 7 — Aplicar: Performance

| Operacao | JS puro | Wasm (Rust) | Ganho |
|----------|---------|-------------|-------|
| Fibonacci(40) | ~1200ms | ~60ms | 20x |
| JSON parse 10MB | ~400ms | ~200ms | 2x |
| Image resize 4K | ~500ms | ~80ms | 6x |
| Regex complexo | ~50ms | ~10ms | 5x |

---

### Passo 8 — Aplicar: Integracao com Next.js

```tsx
"use client";

import { useEffect, useState } from "react";

export function WasmCalculator() {
  const [wasm, setWasm] = useState<typeof import("@/wasm/core")>();

  useEffect(() => {
    import("@/wasm/core").then((module) => {
      module.default(); // init
      setWasm(module);
    });
  }, []);

  if (!wasm) return <div>Carregando...</div>;

  return <div>Resultado: {wasm.calculate_benefit(5000, 30)}</div>;
}
```

---

### Passo 9 — Aplicar: Boas Praticas

- **Lazy loading**: carregar modulo Wasm so quando necessario (code split)
- **Streaming compilation**: usar `WebAssembly.instantiateStreaming` para compilar enquanto baixa
- **Error handling**: Wasm pode falhar (panic) — sempre envolver em try/catch
- **Memory management**: Wasm tem memoria linear propria — gerenciar manualmente em Rust
- **Threads**: SharedArrayBuffer + Web Workers para multi-threading (cuidado com CORS/Sec-Fetch)

### Passo 10 — Aplicar: References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:engineering -->

- Executar a skill conforme o escopo de Triggering Criteria no caso real (não hipotético).
- Percorrer cada passo do Step-by-Step Workflow e confirmar evidência verificável de conclusão (não apenas ausência de erro).
- Confirmar que nenhum Red Flag listado está presente no artefato produzido.
- Registrar resultado (sucesso/falha + motivo) antes de considerar a skill cumprida.

## Common Rationalizations

- **"É só um protótipo, refatoro depois."**
  - Verdade: Protótipo sem testes vira produção por acidente. O 'depois' não existe: quem paga a dívida é o próximo commit. Regra do framework: código esparso ou stub (`TODO`, `implement later`) é entrega proibida.
- **"Compila (ou rodou uma vez), então funciona."**
  - Verdade: Compilar valida sintaxe, não comportamento. Anti-falhas é lei: Executar → Esperar → Verificar resultado esperado → Registrar. Sem verificação, sucesso é suposição.
- **"Caso extremo nunca vai acontecer."**
  - Verdade: Vazio, duplicado, timeout e dado inválido acontecem no primeiro lote real. Validação antes de ação irreversível não é opcional — é pré-condição de execução.
- **"Abstraio agora que depois fica fácil trocar."**
  - Verdade: Abstração especulativa é complexidade desnecessária com custo imediato e benefício imaginário. Simples que resolve > flexível que ninguém entende.
- **"Copiei de um projeto que funcionava, deve servir."**
  - Verdade: Contexto diferente invalida solução copiada. Pesquisa é referência técnica, nunca cópia cega — adaptar exige entender o porquê de cada linha.
- **"Sem tempo para tratar erro, lanço exceção genérica."**
  - Verdade: `except: pass` e erro engolido são proibidos. Falha silenciosa transforma bug de 5 minutos em incidente de 5 horas. Registrar motivo é mais barato que depurar às cegas.

## Red Flags

- Arquivo único gigante misturando I/O, regra de negócio e apresentação.
- Bloco catch vazio, `except: pass` ou erro logado sem motivo/actionável.
- Stub, `TODO` ou função que retorna valor fixo em caminho de produção.
- Credencial, token ou path sensível hardcoded no fonte.
- Sucesso assumido sem verificar o resultado esperado da operação.
- Reexecução unsafe: roda duas vezes e duplica efeito (sem idempotência/checkpoint).

## Legacy Reference (v1)

# Skill WebAssembly — Izanagi

## O Que e WebAssembly

- **Formato binario** de baixo nivel para execucao no browser
- **Compilavel** de C/C++, Rust, Go, Kotlin, AssemblyScript
- **Performance** proxima a nativa (nao e interpretado como JS)
- **Sandbox**: executa no mesmo ambiente seguro que JS
- **Modules**: import/export de funcoes entre Wasm e JS

---

## Casos de Uso no Izanagi

| Caso | Descricao | Linguagem |
|------|-----------|-----------|
| Processamento de imagens | Redimensionar no client | Rust |
| PDF generation | Gerar PDF no client | Rust / C++ |
| Audio processing | Editar audio da radio | C++ (FFmpeg) |
| Data compression | Comprimir/decomprimir dados | Rust |
| Complex calculations | Calculos atuariais (INSS) | Rust |
| Video transcoding | Codificar video para streaming | C++ (libav) |

---

## Rust + Wasm (Preferido)

### Setup
```bash
# Instalar target
rustup target add wasm32-unknown-unknown
# Build tool
cargo install wasm-pack
```

### Projeto
```rust
// src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn calculate_benefit(salary: f64, years: f64) -> f64 {
    salary * years * 0.015
}

#[wasm_bindgen]
pub fn validate_cpf(cpf: &str) -> bool {
    // Validacao de CPF em Rust
}
```

```bash
wasm-pack build --target web
```

### Uso no Frontend
```tsx
import init, { calculate_benefit } from "@/wasm/core";

await init(); // inicializa o modulo wasm
const result = calculate_benefit(5000, 30);
```

---

## AssemblyScript (TypeScript-like)

```typescript
// assembly/index.ts
export function fibonacci(n: i32): i32 {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
```

- Sintaxe similar ao TypeScript (curva de aprendizado baixa)
- Performance inferior ao Rust, mas superior ao JS
- Bom para casos simples de migracao

---

## Performance

| Operacao | JS puro | Wasm (Rust) | Ganho |
|----------|---------|-------------|-------|
| Fibonacci(40) | ~1200ms | ~60ms | 20x |
| JSON parse 10MB | ~400ms | ~200ms | 2x |
| Image resize 4K | ~500ms | ~80ms | 6x |
| Regex complexo | ~50ms | ~10ms | 5x |

---

## Integracao com Next.js

```tsx
"use client";

import { useEffect, useState } from "react";

export function WasmCalculator() {
  const [wasm, setWasm] = useState<typeof import("@/wasm/core")>();

  useEffect(() => {
    import("@/wasm/core").then((module) => {
      module.default(); // init
      setWasm(module);
    });
  }, []);

  if (!wasm) return <div>Carregando...</div>;

  return <div>Resultado: {wasm.calculate_benefit(5000, 30)}</div>;
}
```

---

## Boas Praticas

- **Lazy loading**: carregar modulo Wasm so quando necessario (code split)
- **Streaming compilation**: usar `WebAssembly.instantiateStreaming` para compilar enquanto baixa
- **Error handling**: Wasm pode falhar (panic) — sempre envolver em try/catch
- **Memory management**: Wasm tem memoria linear propria — gerenciar manualmente em Rust
- **Threads**: SharedArrayBuffer + Web Workers para multi-threading (cuidado com CORS/Sec-Fetch)

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
