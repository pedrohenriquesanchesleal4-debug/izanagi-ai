# izanagi_core

The Izanagi Quality Engine: static structural validation of TypeScript,
Python and Go sources against seven slop/stub heuristics
(`STUB_BODY`, `EMPTY_FUNCTION`, `GENERIC_CATCH`, `GENERIC_NAME`,
`REDUNDANT_COMMENT`, `AI_WATERMARK`, `LONG_FUNCTION`), plus the
**Anti-Rationalization Engine**, which lexically detects the framework's
curated rationalizations and red flags inside any agent output. One analysis
implementation, three surfaces:

| Surface | Entry point | Contract |
|---|---|---|
| Rust library | `izanagi_core::analyze(Language, &str) -> AnalysisResult` · `izanagi_core::rationalizations::scan_text(&str) -> ScanReport` | typed structs |
| JSON line protocol (binary `izanagi-core`) | stdin/stdout, one request per line | `{"op":"validate",…}` · `{"op":"scan-rationalizations","text":"…"}` · argv scan mode |
| WebAssembly (`wasm` feature) | `validateSource` / `supportedLanguages` / `ruleIds` / `engineVersion` / `scanRationalizations` / `rationalizationPatternIds` | camelCase JS objects |

## Anti-Rationalization Engine

Detects the rationalizations catalogued by
`packages/skill-migrator/rationalizations.mjs` (engineering, testing,
security, design, docs, devops, data, ai) plus delivery red flags from
`RULES.md` (stub markers, "implement later", checklists-as-delivery). 33
curated patterns live as static data in `src/rationalizations.rs`; matching is
regex-free and single-pass: needles are indexed by their first two characters
(flat 128×128 table) against an accent-folded, lowercased copy of the input,
so scanning is linear with tiny constants and fully deterministic — identical
inputs serialize to byte-identical NDJSON.

```rust
use izanagi_core::rationalizations::scan_text;

let report = scan_text("vou pular os testes porque o prazo apertou");
assert!(!report.clean);
assert_eq!(report.findings[0].pattern_id, "TST-DEFER-WRITING");
assert_eq!(report.findings[0].severity.as_str(), "major");
```

Finding shape (protocol surface, snake_case; ≤120-char excerpts, 1-based lines):

```json
{ "pattern_id": "ENG-STUB-MARKER", "category": "engineering",
  "severity": "blocker", "excerpt": "// TODO: implement later", "line": 1 }
```

Severity contract: `blocker` = stub-grade deliveries (stub markers, deferred
implementation, forged checkbox completions, hardcoded secrets, invented
references, hand-run migrations) · `major` = concrete process failures ·
`minor` = weak beliefs worth review.

The engine is advisory: it scans *agent output* (reports, messages, mixed
prose+code) and complements the structural rules, which own real source files.
Lexical detection has known false-positive surfaces (e.g. a review *quoting*
a bad practice); findings force human review rather than auto-rejection.

### Binary scan mode

```bash
izanagi-core scan-rationalizations --file=agent-output.md   # exit 1 when dirty
echo "checklist: [x] criar banco [x] criar auth" \
  | izanagi-core scan-rationalizations --stdin              # exit 1 when dirty
izanagi-core version    # izanagi-core 0.1.0
izanagi-core help       # usage
```

Exit codes: `0` clean/success · `1` rationalizations detected (CI gate) ·
`2` usage or operational failure. Without arguments the binary keeps speaking
the JSON line protocol exactly as before.

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
| `scanRationalizations(text)` | `{ clean, findings: [{ patternId, category, severity, excerpt, line }] }` | camelCase mirror of the scan report |
| `rationalizationPatternIds()` | `["ENG-STUB-MARKER", …]` | canonical pattern order |

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
typed message, metadata exports agreeing with engine internals, exact
serialized wire shapes for reports and error envelopes, plus the full
Anti-Rationalization contract (category sweep, severity mapping, byte-identical
determinism, 2 MB scale bound, false-positive guards and camelCase wasm wire
shapes).
