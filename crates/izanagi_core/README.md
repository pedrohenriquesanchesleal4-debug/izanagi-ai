# izanagi_core

The Izanagi Quality Engine: static structural validation of TypeScript,
Python and Go sources against seven slop/stub heuristics
(`STUB_BODY`, `EMPTY_FUNCTION`, `GENERIC_CATCH`, `GENERIC_NAME`,
`REDUNDANT_COMMENT`, `AI_WATERMARK`, `LONG_FUNCTION`). One analysis
implementation, three surfaces:

| Surface | Entry point | Contract |
|---|---|---|
| Rust library | `izanagi_core::analyze(Language, &str) -> AnalysisResult` | typed structs |
| JSON line protocol (binary `izanagi-core`) | stdin/stdout, one request per line | `{"op":"validate","language":"go","code":"…"}` |
| WebAssembly (`wasm` feature) | `validateSource` / `supportedLanguages` / `ruleIds` / `engineVersion` | camelCase JS objects |

## Library usage

```rust
use izanagi_core::{analyze, Language};

let result = analyze(Language::Python, "def save():\n    pass\n");
assert!(result.score < 100);
assert!(result.findings.iter().any(|finding| finding.rule == "STUB_BODY"));
```

## WASM bindings (feature `wasm`)

Per ADR-003 the bindings live under an opt-in feature and are **type-checked
on every native build**; producing the actual `.wasm` artifact happens on a
machine with the `wasm32-unknown-unknown` target (CI). The bridge is a thin
shell over the pure layer in `src/wasm.rs` — all engine logic stays shared
with the library and the JSON protocol.

### Exposed API

| JavaScript | Returns | Notes |
|---|---|---|
| `validateSource(source, language)` | report object or throws | see shape below |
| `supportedLanguages()` | `["typescript", "python", "go"]` | derived from `Language::ALL` |
| `ruleIds()` | `["STUB_BODY", …]` | canonical rule order |
| `engineVersion()` | `"0.1.0"` | matches protocol `version` op |

Success payload of `validateSource` (camelCase; findings reuse the JSON
protocol's finding serialization verbatim):

```json
{
  "language": "typescript",
  "score": 65,
  "findings": [
    { "rule": "STUB_BODY",      "severity": "error",   "line": 1, "message": "stub marker(s): TODO" },
    { "rule": "EMPTY_FUNCTION", "severity": "error",   "line": 2, "message": "function 'save' has an empty body" }
  ],
  "rulesChecked": ["STUB_BODY", "EMPTY_FUNCTION", "GENERIC_CATCH",
                   "GENERIC_NAME", "REDUNDANT_COMMENT", "AI_WATERMARK",
                   "LONG_FUNCTION"]
}
```

Failures throw a **typed envelope** (branchable on `code`, never string-parsed):

```json
{
  "code": "UNKNOWN_LANGUAGE",
  "message": "unknown language \"kotlin\": expected \"typescript\", \"python\", \"go\". Call supportedLanguages() for the live list.",
  "supportedLanguages": ["typescript", "python", "go"]
}
```

### Local verification (no rustup required)

```bash
cargo check -p izanagi_core --features wasm   # type-checks every binding
cargo test  -p izanagi_core --features wasm   # pure layer + wire shapes
```

Calling the exports directly on a native host aborts at runtime by design
(the interop boundary only exists under `wasm32`); that is why tests target
the pure layer and pin its serialized forms with `serde_json`.

### Building the real `.wasm` artifact (CI)

```bash
rustup target add wasm32-unknown-unknown

cargo build -p izanagi_core --release \
  --target wasm32-unknown-unknown \
  --features wasm
# → target/wasm32-unknown-unknown/release/izanagi_core.wasm  (crate-type includes cdylib)

# wasm-bindgen-cli version MUST match the resolved wasm-bindgen dependency
# (see Cargo.lock; 0.2.* at time of writing):
cargo install wasm-bindgen-cli --version 0.2.127

wasm-bindgen target/wasm32-unknown-unknown/release/izanagi_core.wasm \
  --out-dir pkg --target nodejs --typescript
# → pkg/izanagi_core.js + pkg/izanagi_core_bg.wasm (+ .d.ts)
```

For bundlers use `--target web` (or `bundler`) instead of `nodejs`; the API
surface is identical.

### Consuming from Node (TypeScript)

```ts
import initSync, {
  validateSource,
  supportedLanguages,
  type Finding,
  type ValidationReport,
} from "./pkg/izanagi_core.js";

// With --target nodejs the module initializes synchronously.
initSync();

console.log(supportedLanguages()); // ["typescript", "python", "go"]

const source = `
// TODO implement later
function save(data) {}
`;

try {
  const report = validateSource(source, "typescript") as ValidationReport;
  if (report.score < 100) {
    for (const finding of report.findings as Finding[]) {
      console.error(`[${finding.severity}] ${finding.rule} @ line ${finding.line}: ${finding.message}`);
    }
    process.exitCode = 1;
  }
} catch (error) {
  // Typed error envelope thrown as a plain object.
  const { code, message } = error as { code: string; message: string };
  if (code === "UNKNOWN_LANGUAGE") {
    console.error(`${message}`);
  }
  throw error;
}
```

### Troubleshooting

- **`error: the wasm32-unknown-unknown target may not be installed`** — run
  `rustup target add wasm32-unknown-unknown`.
- **`wasm-bindgen-cli` panics about mismatched versions at runtime** — the CLI
  version must equal the `wasm-bindgen` entry in `Cargo.lock`. Pin both to the
  same `0.2.x`.
- **Linker errors building cdylib natively** — harmless locally; only the CI
  wasm job needs the cdylib output. Native consumers keep using it as a
  normal rlib dependency.

## Tests

```bash
cargo test --workspace                    # everything except wasm-gated tests
cargo test -p izanagi_core --features wasm # adds binding-layer coverage
```

The gated suite covers: clean code scoring full marks, TODO/stub detection
with exact line attribution, unknown-language rejection with an actionable
typed message, metadata exports agreeing with engine internals, and exact
serialized wire shapes for reports and error envelopes.
