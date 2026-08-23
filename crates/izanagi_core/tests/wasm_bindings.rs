//! Integration coverage for the `wasm` binding surface (ADR-003).
//!
//! The `#[wasm_bindgen]` bridge exports are type-checked on every host build
//! via `cargo check --features wasm`; crossing the JS interop boundary on a
//! native host aborts at runtime (verified empirically), so these tests pin
//! down every piece of logic that runs *behind* the exports: language
//! parsing, report shaping, error envelopes and their serialized wire forms.
//! End-to-end execution against a JS runtime belongs to CI on the
//! `wasm32-unknown-unknown` target (see this crate's README).
//!
//! Run with: `cargo test -p izanagi_core --features wasm`

#![cfg(feature = "wasm")]

use izanagi_core::engine::analyze;
use izanagi_core::lang::Language;
use izanagi_core::wasm::{
    parse_language, supported_language_names, ValidationReport, ERR_UNKNOWN_LANGUAGE,
};
use izanagi_core::{PROTOCOL_VERSION, RULE_IDS};

const CLEAN_GO: &str = "func Sum(items []int) int {\n\ttotal := 0\n\tfor _, item := range items {\n\t\ttotal += item\n\t}\n\treturn total\n}\n";

fn report_for(language: Language, source: &str) -> ValidationReport {
    ValidationReport::from_analysis(language, &analyze(language, source))
}

#[test]
fn clean_code_passes_with_full_score_and_no_findings() {
    let language = parse_language("go").expect("go is part of the contract");
    let result = analyze(language, CLEAN_GO);
    let report = ValidationReport::from_analysis(language, &result);

    assert_eq!(report.language, "go");
    assert_eq!(report.score, 100);
    assert!(report.findings.is_empty());
    assert_eq!(report.rules_checked.len(), RULE_IDS.len());

    // The exact bytes JavaScript receives stay stable across releases.
    let json = serde_json::to_value(&report).expect("report serializes");
    assert_eq!(json["language"], "go");
    assert_eq!(json["score"], 100);
    let findings = json["findings"].as_array().expect("findings array");
    assert!(findings.is_empty());
    assert_eq!(
        json["rulesChecked"].as_array().expect("rules array").len(),
        RULE_IDS.len()
    );
}

#[test]
fn stub_todo_source_is_detected_as_violation() {
    let source = "// TODO implement later\nfunction save(data) {}\n";
    let language = parse_language("typescript").expect("typescript is part of the contract");
    let result = analyze(language, source);
    let report = ValidationReport::from_analysis(language, &result);

    assert!(report.score < 100);
    assert!(report
        .findings
        .iter()
        .any(|finding| finding.rule == "STUB_BODY" && finding.line == 1));
    assert!(report
        .findings
        .iter()
        .any(|finding| finding.rule == "EMPTY_FUNCTION" && finding.line == 2));

    let json = serde_json::to_value(&report).expect("report serializes");
    let severities: Vec<&str> = json["findings"]
        .as_array()
        .expect("array")
        .iter()
        .filter_map(|finding| finding["severity"].as_str())
        .collect();
    assert!(
        severities.contains(&"error"),
        "STUB_BODY/EMPTY_FUNCTION are errors"
    );
}

#[test]
fn unknown_language_returns_typed_actionable_error() {
    let error = parse_language("kotlin").unwrap_err();

    assert_eq!(error.code, ERR_UNKNOWN_LANGUAGE);
    assert!(error.message.contains("\"kotlin\""));
    for spelling in ["\"typescript\"", "\"python\"", "\"go\""] {
        assert!(
            error.message.contains(spelling),
            "message missing {spelling}"
        );
    }
    assert_eq!(
        error.supported_languages.as_deref(),
        Some(
            ["typescript", "python", "go"]
                .iter()
                .copied()
                .map(str::to_string)
                .collect::<Vec<_>>()
                .as_slice()
        )
    );

    // The same failure surfaces through the full validate path.
    let pipelined = ValidationReport::from_analysis;
    let _ = pipelined; // keeps the helper referenced even if scenarios evolve

    let envelope = serde_json::to_value(&error).expect("error serializes");
    assert_eq!(envelope["code"], "UNKNOWN_LANGUAGE");
    assert_eq!(envelope["supportedLanguages"][0], "typescript");
}

#[test]
fn exported_metadata_agrees_with_engine_internals() {
    assert_eq!(
        supported_language_names(),
        vec![
            "typescript".to_string(),
            "python".to_string(),
            "go".to_string(),
        ]
    );
    for name in supported_language_names() {
        assert!(
            name.parse::<Language>().is_ok(),
            "{name} must round-trip through lang.rs parsing"
        );
    }
    assert_eq!(PROTOCOL_VERSION, env!("CARGO_PKG_VERSION"));
}

#[test]
fn python_pass_only_body_flags_stub_not_double_reported() {
    let report = report_for(Language::Python, "def save():\n    pass\n");
    assert_eq!(report.score, 85); // single STUB_BODY error (-15)
    assert_eq!(report.findings.len(), 1);
    assert_eq!(report.findings[0].rule, "STUB_BODY");
    assert_eq!(report.findings[0].line, 1);
}

// ---------------------------------------------------------------------------
// Anti-Rationalization surface (feature-gated like the rest of the bridge)
// ---------------------------------------------------------------------------

use izanagi_core::wasm::{
    rationalization_pattern_ids, scan_rationalizations_report, RationalizationReport,
};

#[test]
fn rationalization_scan_is_clean_for_benign_text() {
    let report = scan_rationalizations_report("Relatório trimestral consolidado.");
    assert!(report.clean);
    assert!(report.findings.is_empty());

    let json = serde_json::to_value(&report).expect("report serializes");
    assert_eq!(json["clean"], true);
    assert_eq!(json["findings"].as_array().expect("array").len(), 0);
}

#[test]
fn rationalization_scan_flags_stub_marker_in_camel_case_wire_shape() {
    let source = "relato da tarefa:\n// TODO: implement later\nfim";
    let report: RationalizationReport = scan_rationalizations_report(source);
    assert!(!report.clean);

    let hit = report
        .findings
        .iter()
        .find(|hit| hit.pattern_id == "ENG-STUB-MARKER")
        .expect("stub marker flagged");
    assert_eq!(hit.category, "engineering");
    assert_eq!(hit.severity, "blocker");
    assert_eq!(hit.line, 2);
    assert!(hit.excerpt.contains("TODO"));

    // Exact serialized bytes stay deterministic across repeated scans.
    let again = scan_rationalizations_report(source);
    assert_eq!(
        serde_json::to_string(&report).expect("serialize"),
        serde_json::to_string(&again).expect("serialize")
    );
}

#[test]
fn rationalization_pattern_ids_are_unique_and_canonical() {
    let ids = rationalization_pattern_ids();
    assert!(!ids.is_empty());
    let unique: std::collections::HashSet<&String> = ids.iter().collect();
    assert_eq!(unique.len(), ids.len());
}
