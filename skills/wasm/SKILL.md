---
name: wasm
description: |
  Skill de WebAssembly (Wasm) para o Portal. Aborda compilacao de linguagens para Wasm,
  integracao com JavaScript, performance, Rust/Wasm, AssemblyScript, e casos de uso
  (processamento pesado no client, portabilidade de bibliotecas).
  Use esta skill para implementar funcionalidades que exigem execucao performatica no browser.
---

# Skill WebAssembly — Portal

## O Que e WebAssembly

- **Formato binario** de baixo nivel para execucao no browser
- **Compilavel** de C/C++, Rust, Go, Kotlin, AssemblyScript
- **Performance** proxima a nativa (nao e interpretado como JS)
- **Sandbox**: executa no mesmo ambiente seguro que JS
- **Modules**: import/export de funcoes entre Wasm e JS

---

## Casos de Uso no Portal

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
