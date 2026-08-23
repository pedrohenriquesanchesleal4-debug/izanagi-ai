//! Anti-Rationalization Engine: deterministic lexical detection of the
//! rationalizations and red flags catalogued by the framework.
//!
//! # Provenance
//!
//! The curated pattern table below is a faithful Rust transcription of
//! `packages/skill-migrator/rationalizations.mjs` (categories engineering,
//! testing, security, design, docs, devops, data, ai) plus the delivery red
//! flags derived from `RULES.md` at the repository root (empty stubs,
//! `TODO`/`FIXME`/`unimplemented`, checklists presented as deliverables,
//! "implement later" deferrals). The `.mjs` file is the curation source —
//! nothing is imported from JavaScript at runtime.
//!
//! # Matching model
//!
//! Purely lexical and regex-free by design:
//!
//! 1. The input is folded char-by-char (ASCII lowercase + diacritic strip)
//!    through a strict 1:1 mapping, so positions in the folded text are
//!    identical to positions in the original text — line numbers and excerpts
//!    stay exact without back-mapping tables.
//! 2. Every needle is indexed by its first folded character; the haystack is
//!    then scanned **once**, verifying only candidate needles that share the
//!    current character. Total work is `O(n · k)` with tiny constants — there
//!    is no backtracking, so no catastrophic path exists.
//! 3. A pattern fires when any of its `any_folded` needles matches
//!    (case/accent-insensitive), or any of its `any_exact` needles matches
//!    byte-for-byte, or its `counted_folded` needles reach `min_counted`
//!    occurrences (used for "≥2 checked checkboxes" signatures).
//!
//! Each pattern yields **at most one finding**, anchored at its first
//! occurrence. Findings are ordered by line, then by canonical pattern order
//! — the same normalization contract as [`crate::rules`] — which makes the
//! serialized output byte-for-byte deterministic for identical inputs.
//!
//! # Semantics
//!
//! This engine is an *advisory gate over agent output* (reports, messages,
//! mixed prose+code), complementary to the structural rules of
//! [`crate::rules`] (which own real source code). Lexical detection has known
//! false-positive surfaces (e.g. a review *quoting* a bad practice); findings
//! are meant to force human review before delivery, not to auto-reject.

use serde::Serialize;

/// Domains inherited from the skill-migrator rationalization library.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Category {
    Engineering,
    Testing,
    Security,
    Design,
    Docs,
    Devops,
    Data,
    Ai,
}

impl Category {
    /// Every category, in the canonical order of the source library.
    pub const ALL: [Category; 8] = [
        Category::Engineering,
        Category::Testing,
        Category::Security,
        Category::Design,
        Category::Docs,
        Category::Devops,
        Category::Data,
        Category::Ai,
    ];

    /// Canonical wire name (matches `CATEGORIES` in the `.mjs` source).
    pub const fn as_str(self) -> &'static str {
        match self {
            Category::Engineering => "engineering",
            Category::Testing => "testing",
            Category::Security => "security",
            Category::Design => "design",
            Category::Docs => "docs",
            Category::Devops => "devops",
            Category::Data => "data",
            Category::Ai => "ai",
        }
    }
}

/// How heavily a rationalization weighs against delivery.
///
/// - `Blocker`: stub-grade violations (framework laws forbid shipping them).
/// - `Major`: concrete process failures that must be fixed before delivery.
/// - `Minor`: weak beliefs/smells worth surfacing for review.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Blocker,
    Major,
    Minor,
}

impl Severity {
    /// Canonical wire name (matches the lowercase serde spelling).
    pub const fn as_str(self) -> &'static str {
        match self {
            Severity::Blocker => "blocker",
            Severity::Major => "major",
            Severity::Minor => "minor",
        }
    }
}

/// One curated anti-rationalization matcher.
///
/// Needles live as static data so the whole detector is inspectable and
/// deterministic. Folded needles MUST already be lowercase and accent-free
/// (enforced by [`self-test`](#implementation-tests) below) because the scan
/// compares them against pre-folded haystacks.
#[derive(Debug)]
pub struct RationalizationPattern {
    /// Stable identifier surfaced on every finding (`ENG-STUB-MARKER`, …).
    pub id: &'static str,
    /// Domain of the rationalization.
    pub category: Category,
    /// Delivery weight of a hit.
    pub severity: Severity,
    /// Human explanation of why the pattern is a violation.
    pub summary: &'static str,
    /// Case/accent-insensitive alternatives; any match fires the pattern.
    pub any_folded: &'static [&'static str],
    /// Case-sensitive alternatives for markers where casing IS the signal
    /// (`TODO` marker vs. the Portuguese word "todo").
    pub any_exact: &'static [&'static str],
    /// Occurrence-counted needles (checkbox signatures); combined with
    /// [`RationalizationPattern::min_counted`].
    pub counted_folded: &'static [&'static str],
    /// Minimum total occurrences of `counted_folded` needed to fire; `0`
    /// disables the counting branch.
    pub min_counted: usize,
}

/// Convenience constructor for the dominant shape: folded alternatives only.
const fn pattern(
    id: &'static str,
    category: Category,
    severity: Severity,
    summary: &'static str,
    any_folded: &'static [&'static str],
) -> RationalizationPattern {
    RationalizationPattern {
        id,
        category,
        severity,
        summary,
        any_folded,
        any_exact: &[],
        counted_folded: &[],
        min_counted: 0,
    }
}

/// Variant adding case-sensitive alternatives (markers whose casing IS the
/// signal, e.g. the `TODO` marker versus the Portuguese word "todo").
const fn pattern_with_exact(
    id: &'static str,
    category: Category,
    severity: Severity,
    summary: &'static str,
    any_folded: &'static [&'static str],
    any_exact: &'static [&'static str],
) -> RationalizationPattern {
    RationalizationPattern {
        id,
        category,
        severity,
        summary,
        any_folded,
        any_exact,
        counted_folded: &[],
        min_counted: 0,
    }
}

/// The curated library. Order is canonical: it breaks ordering ties between
/// findings on the same line and is part of the wire determinism contract.
pub const PATTERNS: &[RationalizationPattern] = &[
    // ------------------------------------------------------------------
    // Engineering
    // ------------------------------------------------------------------
    pattern_with_exact(
        "ENG-STUB-MARKER",
        Category::Engineering,
        Severity::Blocker,
        "Stub markers (TODO/FIXME/unimplemented) left in delivered output are \
         forbidden deliveries per RULES.md; the 'later' they promise never comes.",
        &[
            "todo:",
            "fixme",
            "unimplemented",
            "not implemented",
            "nao implementado",
            "nao implementada",
            "stub temporario",
            "to-do:",
        ],
        &["TODO", "FIXME", "XXX:"],
    ),
    pattern(
        "ENG-IMPLEMENT-LATER",
        Category::Engineering,
        Severity::Blocker,
        "'Implement later' is the stub law's twin: sparse or deferred code is a \
         forbidden delivery, and whoever pays the debt is the next commit.",
        &[
            "implement later",
            "implemento depois",
            "implementar depois",
            "implementamos depois",
            "adiciono depois",
            "depois adiciono",
            "refatoro depois",
            "refatorar depois",
            "complete later",
            "termino depois",
            "finalizo depois",
        ],
    ),
    pattern(
        "ENG-JUST-PROTOTYPE",
        Category::Engineering,
        Severity::Major,
        "An untested prototype becomes production by accident; 'it's just a \
         prototype' does not exempt code from craft.",
        &[
            "so um prototipo",
            "so prototipo",
            "apenas um prototipo",
            "apenas prototipo",
            "codigo descartavel",
            "prototipo descartavel",
            "gambiarra temporaria",
            "throwaway code",
            "quick and dirty",
        ],
    ),
    pattern(
        "ENG-IT-COMPILES",
        Category::Engineering,
        Severity::Major,
        "Compiling validates syntax, not behavior; success without executing and \
         verifying the expected result is assumption, not verification.",
        &[
            "compila entao funciona",
            "compilou entao funciona",
            "compila, entao funciona",
            "rodou uma vez",
            "rodei uma vez e funcionou",
            "rodei uma vez, funcionou",
            "it compiles so it works",
            "compiles therefore it works",
        ],
    ),
    pattern(
        "ENG-EDGE-NEVER",
        Category::Engineering,
        Severity::Major,
        "Empty, duplicate, timeout and invalid data all arrive with the first \
         real batch; validation before irreversible action is a precondition.",
        &[
            "nunca vai acontecer",
            "nunca vai ocorrer",
            "impossivel acontecer",
            "edge case nunca",
            "caso extremo nunca",
            "will never happen in practice",
            "that will never happen",
        ],
    ),
    pattern(
        "ENG-SWALLOW-ERRORS",
        Category::Engineering,
        Severity::Major,
        "`except: pass` and swallowed errors turn a five-minute bug into a \
         five-hour incident; silent failure is prohibited.",
        &[
            "except: pass",
            "except pass",
            "catch vazio",
            "engolir o erro",
            "engolo o erro",
            "engole o erro",
            "silencia o erro",
            "swallow the error",
            "erro pode ser ignorado",
        ],
    ),
    pattern(
        "ENG-CHECKLIST-DELIVERY",
        Category::Engineering,
        Severity::Major,
        "A checklist is a plan, not a deliverable: the Zero-List law demands real, \
         complete code instead of summarized task lists.",
        &[
            "checklist:",
            "check-list:",
            "checklist de entrega",
            "delivery checklist",
        ],
    ),
    RationalizationPattern {
        id: "ENG-CHECKBOX-DELIVERY",
        category: Category::Engineering,
        severity: Severity::Blocker,
        summary: "Multiple checked boxes claiming done-without-code forge completion; \
                  real delivery is source code that builds and passes tests.",
        any_folded: &[],
        any_exact: &[],
        counted_folded: &["[x]"],
        min_counted: 2,
    },
    // ------------------------------------------------------------------
    // Testing
    // ------------------------------------------------------------------
    pattern(
        "TST-DEFER-WRITING",
        Category::Testing,
        Severity::Major,
        "Tests written after stabilization only confirm what the code does; TDD is \
         law — test first, watch it fail, minimal code, refactor.",
        &[
            "escrevo os testes depois",
            "testes depois que estabilizar",
            "teste depois que estabilizar",
            "adiciono testes depois",
            "testes mais tarde",
            "add tests later",
            "tests once it stabilizes",
            "vou pular os testes",
            "pular os testes",
            "skip the tests",
            "skipping the tests",
            "sem testes por enquanto",
        ],
    ),
    pattern(
        "TST-SILENCE-FLAKY",
        Category::Testing,
        Severity::Major,
        "Silent skips teach the suite to lie; flakiness has a cause (fixed sleep, \
         ordering, network) — investigate and fix, never mute.",
        &[
            "esse teste e flaky",
            "este teste e flaky",
            "teste esta flaky",
            "dar skip",
            "dou skip",
            "vou dar skip",
            "marca com skip",
            "describe.skip(",
            "it.skip(",
            "test.skip(",
            "pytest.mark.skip",
            "@unittest.skip",
            "@ignore",
        ],
    ),
    pattern(
        "TST-MOCK-ALL",
        Category::Testing,
        Severity::Major,
        "When every dependency is mocked, the suite validates the mock against \
         itself; integration needs at least one test crossing the true boundary.",
        &[
            "mockei tudo",
            "tudo mockado",
            "mockando tudo",
            "mock everything",
            "mocked everything",
            "suite verde entao ta coberto",
            "suite verde ta coberta",
            "suite verde entao ta coberta",
        ],
    ),
    pattern(
        "TST-QA-CATCHES",
        Category::Testing,
        Severity::Major,
        "QA validates, it does not divine; pushing verification forward multiplies \
         each defect's cost and skips mandatory self-review.",
        &[
            "qa vai pegar",
            "qa pega os bugs",
            "o qa valida depois",
            "qa will catch",
            "tester vai pegar",
            "revisao vai pegar os bugs",
        ],
    ),
    pattern(
        "TST-COVERAGE-THEATER",
        Category::Testing,
        Severity::Minor,
        "Coverage measures execution, not assertion; lines walked without strong \
         expectations are theater.",
        &[
            "cobertura prova",
            "coverage proves",
            "90% de cobertura",
            "cobertura 90%",
            "coverage above 90",
            "coverage of 90",
        ],
    ),
    // ------------------------------------------------------------------
    // Security
    // ------------------------------------------------------------------
    pattern(
        "SEC-TRUSTED-INPUT",
        Category::Security,
        Severity::Major,
        "Today's internal boundary is tomorrow's exposed integration; validation \
         happens where data enters, unconditionally.",
        &[
            "input interno e confiavel",
            "entrada interna e confiavel",
            "input e confiavel",
            "trusted internal input",
            "backend confia",
            "validacao e so para api",
            "validation is only for public",
        ],
    ),
    pattern(
        "SEC-PERIMETER",
        Category::Security,
        Severity::Major,
        "The network perimeter fails routinely (SSRF, leaked credentials, supply \
         chain); defense in depth exists because every layer fails alone.",
        &[
            "atras do firewall",
            "rede privada entao estamos seguros",
            "behind a firewall so",
            "private network so we",
            "estamos seguros porque e interno",
        ],
    ),
    pattern(
        "SEC-LOG-PAYLOAD",
        Category::Security,
        Severity::Major,
        "Payloads carry tokens, PII and credentials; logs are leak files waiting \
         for an audit — structured logging with redaction is mandatory.",
        &[
            "logue tudo incluindo",
            "logar o payload",
            "logue o payload",
            "log everything including",
            "log the full payload",
        ],
    ),
    RationalizationPattern {
        id: "SEC-HARDCODED-SECRET",
        category: Category::Security,
        severity: Severity::Blocker,
        summary: "Secrets hardcoded in versioned code are permanent in Git history; \
                 rotation after a leak costs far more than configuration.",
        any_folded: &[
            "secret hardcoded",
            "hardcoded secret",
            "token hardcoded",
            "chave hardcoded",
            "senha hardcoded",
            "password hardcoded",
            "api key hardcoded",
            "credencial hardcoded",
            "hardcode o secret",
            "hardcodei o token",
            "hardcodei a chave",
        ],
        any_exact: &[],
        counted_folded: &[],
        min_counted: 0,
    },
    // ------------------------------------------------------------------
    // Design
    // ------------------------------------------------------------------
    pattern(
        "DSN-INTER-NEUTRAL",
        Category::Design,
        Severity::Major,
        "Inter-by-default is tell nº 1 of AI slop; typography is an identity \
         decision, and 'neutral here' means intentionless — which is prohibited.",
        &[
            "inter serve",
            "inter e neutra",
            "inter is neutral",
            "just use inter",
            "usa inter",
        ],
    ),
    pattern(
        "DSN-RESPONSIVE-LAST",
        Category::Design,
        Severity::Major,
        "Desktop-only layouts break structurally on mobile: grid, hierarchy and \
         touch targets get redesigned, not adjusted.",
        &[
            "responsivo eu ajusto",
            "responsivo depois",
            "responsividade no final",
            "responsive at the end",
            "ajusto responsivo",
            "primeiro o desktop",
        ],
    ),
    pattern(
        "DSN-A11Y-LATER",
        Category::Design,
        Severity::Major,
        "Contrast, visible focus and ARIA are WCAG requirements, not feature \
         requests; retrofitting accessibility costs orders of magnitude more.",
        &[
            "acessibilidade quando tiver demanda",
            "acessibilidade a gente adiciona",
            "acessibilidade depois",
            "aria depois",
            "accessibility when users ask",
            "accessibility later",
        ],
    ),
    pattern(
        "DSN-AI-SLOP-COMPOSITION",
        Category::Design,
        Severity::Minor,
        "Hero + row of 3 cards + purple gradient is the statistical AI composition \
         the framework explicitly bans as an anti-pattern.",
        &[
            "hero com 3 cards",
            "hero com tres cards",
            "hero + 3 cards",
            "3 cards identicos",
            "tres cards identicos",
            "gradiente roxo",
            "purple gradient",
        ],
    ),
    // ------------------------------------------------------------------
    // Docs
    // ------------------------------------------------------------------
    pattern(
        "DOC-SELF-DOCUMENTING",
        Category::Docs,
        Severity::Minor,
        "Code shows the HOW, never the WHY nor the usage contract; a README with \
         install/run/config is part of the delivery, not a courtesy.",
        &[
            "se auto documenta",
            "auto-documenta",
            "auto documenta",
            "self documenting",
            "comentario e redundancia",
            "comment is redundant",
        ],
    ),
    pattern(
        "DOC-README-LATER",
        Category::Docs,
        Severity::Major,
        "'Before publishing' means after forgetting; docs written alongside the \
         implementation capture decisions memory loses in three days.",
        &[
            "readme eu escrevo",
            "readme antes do publish",
            "readme depois do publish",
            "documentacao antes do publish",
            "docs i write before release",
            "documentacao depois do launch",
        ],
    ),
    pattern(
        "DOC-INVENTED-REFERENCE",
        Category::Docs,
        Severity::Blocker,
        "An invented URL is documented hallucination; never ship an unverified \
         reference — research it or state plainly that it was not verified.",
        &[
            "referencia eu completo depois",
            "url inventada",
            "inventei a url",
            "link placeholder",
            "placeholder url",
            "coloca um link qualquer",
            "coloco um link qualquer",
            "url de mentira",
        ],
    ),
    // ------------------------------------------------------------------
    // DevOps
    // ------------------------------------------------------------------
    pattern(
        "OPS-WORKS-LOCALLY",
        Category::Devops,
        Severity::Major,
        "Environment is part of the system; without reproducible IaC/containers, \
         'works on my machine' is undiagnosed config drift — the bug itself.",
        &[
            "funciona na minha maquina",
            "works on my machine",
            "problema e o ambiente",
        ],
    ),
    pattern(
        "OPS-OBSERVE-LATER",
        Category::Devops,
        Severity::Major,
        "Without baseline metrics, degradation is invisible until the outage; \
         observability precedes scaling and manual processes fossilize.",
        &[
            "monitoramento quando escalar",
            "monitoramento a gente implanta",
            "pipeline depois que estabilizar",
            "ci depois que estabilizar",
            "observabilidade depois que",
            "monitoring once we scale",
        ],
    ),
    pattern(
        "OPS-BYPASS-GATES",
        Category::Devops,
        Severity::Major,
        "Skipped checks mean the gate does not exist; if the gate is wrong, fix \
         the gate — bypassing it defines the team's new standard.",
        &[
            "pular os checks",
            "pulando os checks",
            "pular o ci",
            "pulando o ci",
            "skip ci",
            "[skip ci]",
            "bypass dos checks",
            "contorna o gate",
        ],
    ),
    // ------------------------------------------------------------------
    // Data
    // ------------------------------------------------------------------
    pattern(
        "DAT-ASSUME-CLEAN",
        Category::Data,
        Severity::Major,
        "Production holds empty, duplicated, legacy-format and outlier data from \
         day one; schema validation before load is the minimum.",
        &[
            "dados de producao sao limpos",
            "dado sujo nao existe",
            "validacao em lote e paranoia",
            "prod data is clean",
            "batch validation is paranoia",
        ],
    ),
    pattern(
        "DAT-MANUAL-MIGRATION",
        Category::Data,
        Severity::Blocker,
        "Hand-run migration under pressure, without dry-run or rollback, is the \
         classic irreversible-loss scenario.",
        &[
            "migro na mao",
            "migrar na mao",
            "migracao na mao",
            "migro essa base na mao",
            "sql direto na producao",
            "update sem where",
            "delete sem where",
            "rodo na producao direto",
        ],
    ),
    pattern(
        "DAT-INDEX-LATER",
        Category::Data,
        Severity::Minor,
        "Without indexes, slowness hits production at peak and emergency indexing \
         locks the table exactly then; modeling includes planned access paths.",
        &[
            "indice quando ficar lento",
            "indice a gente cria quando",
            "indice se precisar",
            "index when it gets slow",
            "otimizacao de query depois",
        ],
    ),
    // ------------------------------------------------------------------
    // AI
    // ------------------------------------------------------------------
    pattern(
        "AI-VIBES-OK",
        Category::Ai,
        Severity::Major,
        "Plausibility is the product, not proof; without evaluation (dataset, \
         criteria, comparison) you are validating rhetoric.",
        &[
            "pareceu bom",
            "pareceu boa",
            "resposta plausivel entao",
            "plausivel entao ta correto",
            "looked plausible",
            "seems plausible so",
            "avaliacao depois",
            "eval later",
            "olhometricamente aprovado",
        ],
    ),
    pattern(
        "AI-BIGGER-MODEL",
        Category::Ai,
        Severity::Minor,
        "Upgrading the model masks chunking, retrieval and data-quality problems \
         while multiplying cost; diagnose the RAG pipeline first.",
        &[
            "troco o modelo maior",
            "modelo maior resolve",
            "uso um modelo maior",
            "bigger model will fix",
            "upgrade do modelo resolve",
        ],
    ),
    pattern(
        "AI-INJECTION-THEORETICAL",
        Category::Ai,
        Severity::Major,
        "Every user/recovered text is an injection surface; 'closed case' means \
         fewer vectors, never zero — defense costs one instruction and a filter.",
        &[
            "prompt injection e teorico",
            "injection e teorico",
            "meu caso e fechado",
            "caso fechado entao nao precisa",
            "injection is theoretical",
            "closed system so no injection",
        ],
    ),
];

// --------------------------------------------------------------------------
// Scanning
// --------------------------------------------------------------------------

/// One detected rationalization, shaped exactly as the wire contract requires
/// (`pattern_id`, `category`, `severity`, `excerpt` ≤120 chars, 1-based `line`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RationalizationFinding {
    pub pattern_id: String,
    pub category: Category,
    pub severity: Severity,
    pub excerpt: String,
    pub line: u32,
}

/// Outcome of scanning one text blob.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ScanReport {
    /// `true` when no curated pattern fired.
    pub clean: bool,
    /// Findings ordered by line, then canonical pattern order (deterministic).
    pub findings: Vec<RationalizationFinding>,
}

/// Maximum number of characters carried by [`RationalizationFinding::excerpt`].
pub const EXCERPT_MAX_CHARS: usize = 120;

/// Context chars kept before the hit inside an excerpt.
const EXCERPT_BEFORE: usize = 40;

/// Folds one char into its normalized form via a strict 1:1 mapping
/// (lowercase + PT-BR/common-latin diacritic strip). Position-preserving by
/// construction: one input char always yields exactly one output char.
fn fold_char(c: char) -> char {
    let lower = c.to_lowercase().next().unwrap_or(c);
    match lower {
        'à'..='å' | 'ā' | 'ă' | 'ą' => 'a',
        'è'..='ë' | 'ē' | 'ĕ' | 'ę' => 'e',
        'ì'..='ï' | 'ī' | 'ĭ' | 'ĩ' => 'i',
        'ò'..='ö' | 'ō' | 'ŏ' | 'ő' => 'o',
        'ù'..='ü' | 'ū' | 'ŭ' | 'ű' | 'ų' => 'u',
        'ç' | 'ć' | 'č' => 'c',
        'ñ' | 'ń' | 'ň' => 'n',
        'ý' | 'ÿ' => 'y',
        other => other,
    }
}

/// Naive slice comparison anchored at `pos` (needles are tiny constants, so
/// this beats fancier algorithms while staying allocation-free).
fn matches_at(haystack: &[char], pos: usize, needle: &[char]) -> bool {
    haystack.len() >= pos + needle.len() && haystack[pos..pos + needle.len()] == *needle
}

/// Builds the excerpt around `pos`: ≤[`EXCERPT_MAX_CHARS`] original chars,
/// control characters collapsed, whitespace trimmed at both ends.
fn excerpt_of(chars: &[char], pos: usize) -> String {
    let start = pos.saturating_sub(EXCERPT_BEFORE);
    let end = (start + EXCERPT_MAX_CHARS).min(chars.len());
    // The window itself is ≤ EXCERPT_MAX_CHARS wide, so no truncation (and
    // therefore no char-boundary hazard) is ever needed; trim only shrinks.
    let excerpt: String = chars[start..end]
        .iter()
        .map(|&c| match c {
            '\n' | '\r' | '\t' => ' ',
            other => other,
        })
        .collect();
    excerpt.trim().to_string()
}

/// 1-based line of the char at `pos`.
fn line_of(chars: &[char], pos: usize) -> u32 {
    (chars[..pos.min(chars.len())]
        .iter()
        .filter(|&&c| c == '\n')
        .count()
        + 1) as u32
}

/// Scans arbitrary agent output (prose, code, reports) against every curated
/// pattern. Deterministic: identical inputs yield byte-identical serialized
/// reports, with findings ordered by line then canonical pattern order.
///
/// Complexity: one fold pass plus one scan pass whose per-position work is
/// `O(candidates sharing the position's two-char prefix)` — effectively
/// constant on non-matching text. There is no backtracking anywhere.
pub fn scan_text(text: &str) -> ScanReport {
    let originals: Vec<char> = text.chars().collect();
    let folded: Vec<char> = originals.iter().copied().map(fold_char).collect();

    // Needle indexes keyed by the needle's first TWO characters (all curated
    // needles are ≥2 chars — enforced by the unit suite). A flat 128×128 table
    // keeps lookups branch-free O(1); non-ASCII pairs cannot match any needle
    // and are skipped. Insertion order follows canonical PATTERNS order, so
    // candidate iteration stays deterministic.
    const TABLE: usize = 128 * 128;
    let mut folded_index: Vec<Vec<(usize, Vec<char>)>> = vec![Vec::new(); TABLE];
    let mut exact_index: Vec<Vec<(usize, Vec<char>)>> = vec![Vec::new(); TABLE];
    let mut counted_index: Vec<Vec<(usize, Vec<char>)>> = vec![Vec::new(); TABLE];

    for (pattern_index, candidate) in PATTERNS.iter().enumerate() {
        for needle in candidate.any_folded {
            insert_needle(&mut folded_index, pattern_index, needle);
        }
        for needle in candidate.any_exact {
            insert_needle(&mut exact_index, pattern_index, needle);
        }
        for needle in candidate.counted_folded {
            insert_needle(&mut counted_index, pattern_index, needle);
        }
    }

    let mut first_hit: [Option<usize>; PATTERNS.len()] = [None; PATTERNS.len()];
    let mut hit_counts = vec![0usize; PATTERNS.len()];

    /// Flat-table slot of a two-char prefix, or `None` when either char falls
    /// outside ASCII (no needle can start there).
    fn slot(table: &[Vec<(usize, Vec<char>)>], a: char, b: char) -> Option<&[(usize, Vec<char>)]> {
        let (x, y) = (a as u32, b as u32);
        if x < 128 && y < 128 {
            table.get((x * 128 + y) as usize).map(Vec::as_slice)
        } else {
            None
        }
    }

    for pos in 0..originals.len() {
        // Pass 1: folded needles against the folded haystack.
        if pos + 1 < folded.len() {
            if let Some(candidates) = slot(&folded_index, folded[pos], folded[pos + 1]) {
                for &(pattern_index, ref needle) in candidates {
                    if first_hit[pattern_index].is_none() && matches_at(&folded, pos, needle) {
                        first_hit[pattern_index] = Some(pos);
                    }
                }
            }
        }
        // Pass 2: case-sensitive needles against the raw haystack.
        if pos + 1 < originals.len() {
            if let Some(candidates) = slot(&exact_index, originals[pos], originals[pos + 1]) {
                for &(pattern_index, ref needle) in candidates {
                    if first_hit[pattern_index].is_none() && matches_at(&originals, pos, needle) {
                        first_hit[pattern_index] = Some(pos);
                    }
                }
            }
        }
        // Pass 3: counted needles accumulate every occurrence.
        if pos + 1 < folded.len() {
            if let Some(candidates) = slot(&counted_index, folded[pos], folded[pos + 1]) {
                for &(pattern_index, ref needle) in candidates {
                    if matches_at(&folded, pos, needle) {
                        hit_counts[pattern_index] += 1;
                        if first_hit[pattern_index].is_none() {
                            first_hit[pattern_index] = Some(pos);
                        }
                    }
                }
            }
        }
    }

    // Assemble: one finding per fired pattern, ordered by (line, canonical idx).
    let mut findings: Vec<RationalizationFinding> = PATTERNS
        .iter()
        .zip(first_hit.iter())
        .enumerate()
        .filter_map(|(pattern_index, (candidate, hit))| {
            let pos = (*hit)?;
            // Counting patterns fire only once their threshold is reached;
            // the anchor is the first occurrence recorded during the count.
            if candidate.min_counted > 0 && hit_counts[pattern_index] < candidate.min_counted {
                return None;
            }
            Some(RationalizationFinding {
                pattern_id: candidate.id.to_string(),
                category: candidate.category,
                severity: candidate.severity,
                excerpt: excerpt_of(&originals, pos),
                line: line_of(&originals, pos),
            })
        })
        .collect();

    // Deterministic wire order: line ascending, ties broken by canonical
    // pattern order (assembly above iterates PATTERNS, so rank = position).
    findings.sort_by(|x, y| {
        x.line.cmp(&y.line).then_with(|| {
            let rank_x = PATTERNS.iter().position(|p| p.id == x.pattern_id);
            let rank_y = PATTERNS.iter().position(|p| p.id == y.pattern_id);
            rank_x.cmp(&rank_y).then_with(|| x.excerpt.cmp(&y.excerpt))
        })
    });

    ScanReport {
        clean: findings.is_empty(),
        findings,
    }
}

/// Registers one needle under its two-char prefix bucket. Needles shorter
/// than two chars cannot be indexed (and would be ambiguous markers anyway);
/// the unit suite pins the "≥2 chars" invariant of the curated data, and this
/// helper defensively skips anything shorter instead of mis-detecting.
fn insert_needle(table: &mut [Vec<(usize, Vec<char>)>], pattern_index: usize, needle: &str) {
    let chars: Vec<char> = needle.chars().collect();
    debug_assert!(chars.len() >= 2, "curated needles must have ≥2 chars");
    let Some(&a) = chars.first() else { return };
    let Some(&b) = chars.get(1) else { return };
    let (x, y) = (a as u32, b as u32);
    if x < 128 && y < 128 {
        table[(x * 128 + y) as usize].push((pattern_index, chars));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fold_char_is_position_preserving_and_normalizes_pt_diacritics() {
        assert_eq!(fold_char('É'), 'e');
        assert_eq!(fold_char('ó'), 'o');
        assert_eq!(fold_char('Ã'), 'a');
        assert_eq!(fold_char('ç'), 'c');
        assert_eq!(fold_char('T'), 't');
        assert_eq!(fold_char('-'), '-');
        assert_eq!(fold_char('3'), '3');
    }

    #[test]
    fn every_curated_needle_is_already_normalized() {
        for candidate in PATTERNS {
            for needle in candidate.any_folded.iter().chain(candidate.counted_folded) {
                let folded: String = needle.chars().map(fold_char).collect();
                assert_eq!(
                    folded, *needle,
                    "{}: needle {needle:?} must be pre-folded (lowercase, accent-free)",
                    candidate.id
                );
                assert!(
                    !needle.is_empty(),
                    "{} has an empty folded needle",
                    candidate.id
                );
            }
            for needle in candidate.any_exact {
                assert!(
                    !needle.is_empty(),
                    "{} has an empty exact needle",
                    candidate.id
                );
            }
            if candidate.min_counted > 0 {
                assert!(
                    !candidate.counted_folded.is_empty(),
                    "{} sets min_counted without counted needles",
                    candidate.id
                );
            } else {
                assert!(
                    candidate.counted_folded.is_empty(),
                    "{} curates counted needles without a threshold",
                    candidate.id
                );
            }
        }
    }

    #[test]
    fn excerpt_collapses_control_chars_and_respects_bound() {
        let noisy: String =
            "x".repeat(200) + "\n\t" + &"y".repeat(50) + " TODO " + &"z".repeat(300);
        let chars: Vec<char> = noisy.chars().collect();
        let pos = noisy.find("TODO").expect("marker present");
        let excerpt = excerpt_of(&chars, pos);
        assert!(excerpt.chars().count() <= EXCERPT_MAX_CHARS);
        assert!(!excerpt.contains('\n'));
        assert!(!excerpt.contains('\t'));
        assert!(excerpt.starts_with('x') || excerpt.starts_with('y'));
    }

    #[test]
    fn line_counts_are_one_based_across_newlines() {
        let text = "a\nb\nc TODO d";
        let chars: Vec<char> = text.chars().collect();
        let pos = text.find("TODO").expect("present");
        assert_eq!(line_of(&chars, pos), 3);
        assert_eq!(line_of(&[], 0), 1);
    }

    #[test]
    fn checkbox_threshold_requires_two_claimed_done_items() {
        let single = scan_text("- [x] item único concluído");
        assert!(single.clean, "one [x] must stay below the threshold");

        let two = scan_text("[x] criar banco\n[x] criar auth");
        assert!(two
            .findings
            .iter()
            .any(|f| f.pattern_id == "ENG-CHECKBOX-DELIVERY"));
        assert_eq!(
            find_by_id(&two, "ENG-CHECKBOX-DELIVERY").line,
            1,
            "counted pattern anchors at its first occurrence"
        );
    }

    #[test]
    fn exact_case_marker_beats_portuguese_word_false_positive() {
        let pt_word = scan_text("Vou listar todo o catálogo amanhã cedo.");
        assert!(pt_word.clean, "bare Portuguese 'todo' must NOT fire");

        let marker = scan_text("pronto!\n// TODO revisar antes do merge");
        let finding = find_by_id(&marker, "ENG-STUB-MARKER");
        assert_eq!(finding.line, 2);
        assert_eq!(finding.severity, Severity::Blocker);
    }

    #[test]
    fn empty_input_produces_clean_report_without_panics() {
        let report = scan_text("");
        assert!(report.clean);
        assert!(report.findings.is_empty());
    }

    fn find_by_id<'a>(report: &'a ScanReport, id: &str) -> &'a RationalizationFinding {
        report
            .findings
            .iter()
            .find(|finding| finding.pattern_id == id)
            .unwrap_or_else(|| panic!("{id} missing"))
    }
}
