//! Integration coverage for the Anti-Rationalization Engine.
//!
//! These tests pin the *public* contract of `izanagi_core::rationalizations`
//! across every surface: library scan, JSON line protocol op and the data set
//! itself (categories, severities, determinism and scale limits).

use izanagi_core::protocol::handle_request;
use izanagi_core::rationalizations::{
    scan_text, Category, RationalizationFinding, ScanReport, Severity, PATTERNS,
};

// --------------------------------------------------------------------------
// (a) clean text → { clean: true, findings: [] }
// --------------------------------------------------------------------------

#[test]
fn empty_and_blank_inputs_are_clean() {
    for blank in ["", " ", "\n", "\t \r\n      "] {
        let report = scan_text(blank);
        assert!(report.clean, "{blank:?} should be clean");
        assert!(
            report.findings.is_empty(),
            "{blank:?} should have no findings"
        );
    }
}

#[test]
fn innocent_prose_stays_clean_in_pt_and_en() {
    let innocents = [
        // "todo" as the Portuguese word for "all/every" — no colon, lowercase.
        "Vou listar todo o catálogo depois da reunião.",
        "O pipeline roda todos os dias às 8h sem falhar.",
        // "later"/"depois" alone carries no deferral confession.
        "Depois da revisão eu respondo o e-mail do cliente.",
        "We benchmarked the parser and later published the numbers.",
        // A single unchecked-style note must not trip the checkbox rule.
        "- [x] única nota concluída no diário de bordo",
        // Legitimate engineering discussion without rationalizing.
        "Adicionei tratamento de erro com retry exponencial e checkpoint.",
        "The prototype taught us the schema; production code landed reviewed.",
        // QA doing its job is not QA-will-catch-it laziness.
        "A suíte de integração atravessa a borda real do banco.",
    ];
    for sample in innocents {
        let report = scan_text(sample);
        assert!(
            report.findings.is_empty(),
            "{sample:?} should be clean, got {:?}",
            report
                .findings
                .iter()
                .map(|f| f.pattern_id.as_str())
                .collect::<Vec<_>>()
        );
        assert!(report.clean);
    }
}

// --------------------------------------------------------------------------
// (b) every category has ≥1 pattern that fires (realistic PT-BR and EN)
// --------------------------------------------------------------------------

fn ids(report: &ScanReport) -> Vec<&str> {
    report
        .findings
        .iter()
        .map(|f| f.pattern_id.as_str())
        .collect()
}

#[test]
fn every_category_fires_on_a_realistic_sample() {
    let samples: [(Category, &str, &str); 8] = [
        (
            Category::Engineering,
            "É só um protótipo, depois adiciono tratamento de erro.",
            "ENG-JUST-PROTOTYPE",
        ),
        (
            Category::Testing,
            "Vou pular os testes porque o prazo apertou.",
            "TST-DEFER-WRITING",
        ),
        (
            Category::Security,
            "Input interno é confiável, validação é para API pública.",
            "SEC-TRUSTED-INPUT",
        ),
        (
            Category::Design,
            "Inter serves fine, it's neutral, we ship faster.",
            "DSN-INTER-NEUTRAL",
        ),
        (
            Category::Docs,
            "README eu escrevo antes do publish, agora não dá.",
            "DOC-README-LATER",
        ),
        (
            Category::Devops,
            "Funciona na minha máquina, o problema é o ambiente.",
            "OPS-WORKS-LOCALLY",
        ),
        (
            Category::Data,
            "Dados de produção são limpos, validação em lote é paranoia.",
            "DAT-ASSUME-CLEAN",
        ),
        (
            Category::Ai,
            "The reply looked plausible so it is correct; ship it.",
            "AI-VIBES-OK",
        ),
    ];
    for (category, sample, expected_id) in samples {
        let report = scan_text(sample);
        let found = ids(&report);
        assert!(
            found.contains(&expected_id),
            "{category:?}: sample {sample:?} should fire {expected_id}, got {found:?}"
        );
        assert!(!report.clean);
        assert!(
            report.findings.iter().all(|f| f.category == category),
            "{category:?}: every finding of this sample must carry its category"
        );
    }
}

#[test]
fn english_stub_marker_and_accented_uppercase_pt_both_fire() {
    let en = scan_text("// TODO: implement later\nconst x = 1;\n");
    assert!(ids(&en).contains(&"ENG-STUB-MARKER"));

    // Accent/case folding: "É SÓ UM PROTOTIPO" must match "so um prototipo".
    let pt = scan_text("RELAXA, É SÓ UM PROTÓTIPO!");
    assert!(ids(&pt).contains(&"ENG-JUST-PROTOTYPE"));
}

#[test]
fn checklist_as_final_deliverable_is_flagged_twofold() {
    let report =
        scan_text("pronto, segue entrega final:\nchecklist: [x] criar banco [x] criar auth");
    let found = ids(&report);
    // Claimed-done checkboxes pretending to be code = blocker-grade.
    assert!(
        found.contains(&"ENG-CHECKBOX-DELIVERY"),
        "≥2 checked boxes must fire the blocker, got {found:?}"
    );
    // Presenting a checklist as the deliverable itself is at least major.
    assert!(
        found.contains(&"ENG-CHECKLIST-DELIVERY"),
        "checklist-as-delivery label must fire, got {found:?}"
    );
}

// --------------------------------------------------------------------------
// (c) severity mapping: stub=blocker, deferred tests=major, redundant comment=minor
// --------------------------------------------------------------------------

fn find_pattern<'r>(report: &'r ScanReport, id: &str) -> &'r RationalizationFinding {
    report
        .findings
        .iter()
        .find(|f| f.pattern_id == id)
        .unwrap_or_else(|| panic!("{id} missing in {:?}", ids(report)))
}

#[test]
fn stub_markers_are_blockers() {
    let report = scan_text("função de salvar:\n// TODO: implement later\nsalvar(dados);");
    let finding = find_pattern(&report, "ENG-STUB-MARKER");
    assert_eq!(finding.severity, Severity::Blocker);
    assert_eq!(finding.line, 2, "line attribution must follow the marker");
}

#[test]
fn deferring_tests_is_major() {
    let report = scan_text("Vou pular os testes porque o prazo apertou.");
    assert_eq!(
        find_pattern(&report, "TST-DEFER-WRITING").severity,
        Severity::Major
    );
}

#[test]
fn self_documenting_code_belief_is_minor() {
    let report = scan_text("Código limpo se auto-documenta, comentário é redundância.");
    assert_eq!(
        find_pattern(&report, "DOC-SELF-DOCUMENTING").severity,
        Severity::Minor
    );
}

// --------------------------------------------------------------------------
// (d) determinism: same input → byte-identical output, stable finding order
// --------------------------------------------------------------------------

const SLOPPY_MULTI_HIT: &str = concat!(
    "Relatório da tarefa:\n",
    "Mockei tudo e a suite ficou verde.\n",
    "// TODO: implement later\n",
    "Design segue o de sempre: hero com 3 cards e gradiente roxo.\n",
);

#[test]
fn repeated_scans_produce_byte_identical_reports() {
    let first = scan_text(SLOPPY_MULTI_HIT);
    let second = scan_text(SLOPPY_MULTI_HIT);
    assert_eq!(first.findings, second.findings);
    let bytes_first = serde_json::to_string(&first).expect("serialize");
    let bytes_second = serde_json::to_string(&second).expect("serialize");
    assert_eq!(bytes_first, bytes_second, "wire bytes must be identical");
    assert!(serde_json::from_str::<serde_json::Value>(&bytes_first).is_ok());
}

#[test]
fn findings_order_is_line_then_canonical_pattern_order() {
    // One line triggering two patterns: ENG-STUB-MARKER (canonical index 0)
    // must precede TST-MOCK-ALL despite both sitting on the same line.
    let report = scan_text("// TODO revisar mock\nMockei tudo, suite verde entao ta coberto.");
    let found = ids(&report);
    let stub = found
        .iter()
        .position(|id| *id == "ENG-STUB-MARKER")
        .expect("stub hit");
    let mock = found
        .iter()
        .position(|id| *id == "TST-MOCK-ALL")
        .expect("mock hit");
    assert!(
        stub < mock,
        "canonical order must break line ties: {found:?}"
    );

    // Cross-line ordering follows the line number ascending.
    let multi = scan_text(SLOPPY_MULTI_HIT);
    let lines: Vec<u32> = multi.findings.iter().map(|f| f.line).collect();
    let mut sorted = lines.clone();
    sorted.sort_unstable();
    assert_eq!(lines, sorted, "findings must be ordered by line: {lines:?}");
}

// --------------------------------------------------------------------------
// (e) limits: huge text scans in reasonable time, excerpts stay bounded
// --------------------------------------------------------------------------

const BENIGN_LINE: &str = "Relatório trimestral consolidado com indicadores operacionais.\n";

#[test]
fn multi_megabyte_input_scans_fast_and_finds_the_deep_needle() {
    let repeats = 27_000; // ≈ 2 MB in debug-friendly size
    let mut huge = String::with_capacity(BENIGN_LINE.len() * repeats + 64);
    for _ in 0..repeats {
        huge.push_str(BENIGN_LINE);
    }
    huge.push_str("// TODO: implement later\n");

    let started = std::time::Instant::now();
    let report = scan_text(&huge);
    let elapsed = started.elapsed();

    assert!(
        elapsed < std::time::Duration::from_secs(5),
        "scanning ~2MB took {elapsed:?}; single-pass budget blown"
    );
    let finding = find_pattern(&report, "ENG-STUB-MARKER");
    assert_eq!(
        finding.line,
        (repeats + 1) as u32,
        "needle sits on the very last line — full traversal proof"
    );
}

#[test]
fn excerpt_is_bounded_to_120_chars_even_on_giant_lines() {
    let mut giant_line = "A".repeat(3_000);
    giant_line.push_str(" TODO ");
    giant_line.push_str(&"B".repeat(3_000));
    let report = scan_text(&giant_line);
    let finding = find_pattern(&report, "ENG-STUB-MARKER");
    assert_eq!(finding.line, 1);
    assert!(
        finding.excerpt.chars().count() <= 120,
        "excerpt must stay ≤120 chars, got {}",
        finding.excerpt.chars().count()
    );
    assert!(finding.excerpt.contains("TODO"));
}

// --------------------------------------------------------------------------
// Data-set integrity: unique ids, normalized needles, full category coverage
// --------------------------------------------------------------------------

#[test]
fn pattern_table_has_unique_ids_and_full_category_coverage() {
    let mut seen = std::collections::HashSet::new();
    for pattern in PATTERNS {
        assert!(
            seen.insert(pattern.id),
            "duplicate pattern id {}",
            pattern.id
        );
        assert!(
            !pattern.summary.trim().is_empty(),
            "{} lacks summary",
            pattern.id
        );
    }
    for category in Category::ALL {
        let covered = PATTERNS.iter().any(|p| p.category == category);
        assert!(covered, "{category:?} has no curated pattern");
    }
}

// --------------------------------------------------------------------------
// Protocol surface: the NDJSON op speaks the documented shape
// --------------------------------------------------------------------------

#[test]
fn protocol_op_scan_rationalizations_returns_documented_shape() {
    let response = handle_request(
        r#"{"op":"scan-rationalizations","text":"vou pular os testes porque atrasa"}"#,
    )
    .expect("non-blank request");
    let json: serde_json::Value = serde_json::from_str(&response).expect("valid ndjson line");
    assert_eq!(json["ok"], true);
    assert_eq!(json["clean"], false);
    let finding = &json["findings"][0];
    assert_eq!(finding["pattern_id"], "TST-DEFER-WRITING");
    assert_eq!(finding["category"], "testing");
    assert_eq!(finding["severity"], "major");
    assert_eq!(finding["line"], 1);
    assert!(finding["excerpt"].as_str().expect("excerpt").len() <= 480); // 120 chars ≤ 480 utf-8 bytes
}

#[test]
fn protocol_op_clean_text_answers_clean_true_with_empty_findings() {
    let response = handle_request(r#"{"op":"scan-rationalizations","text":"tudo certo por aqui"}"#)
        .expect("non-blank request");
    let json: serde_json::Value = serde_json::from_str(&response).expect("valid ndjson line");
    assert_eq!(json["ok"], true);
    assert_eq!(json["clean"], true);
    assert_eq!(json["findings"].as_array().expect("array").len(), 0);
}

#[test]
fn protocol_op_without_text_yields_structured_error() {
    let response = handle_request(r#"{"op":"scan-rationalizations"}"#).expect("non-blank request");
    let json: serde_json::Value = serde_json::from_str(&response).expect("valid ndjson line");
    assert_eq!(json["ok"], false);
    assert!(json["error"]
        .as_str()
        .expect("error")
        .starts_with("invalid request"));
}
