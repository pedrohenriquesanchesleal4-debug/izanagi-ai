//! WebAssembly bindings over the Quality Engine, gated behind the `wasm`
//! feature (ADR-003).
//!
//! The module is split in two layers so that *all* logic is testable on a
//! plain host while the JS marshaling stays a thin, type-checked shell:
//!
//! 1. **Pure layer** — [`parse_language`], [`ValidationReport`] and
//!    [`WasmError`]: ordinary Rust values implementing `serde::Serialize`.
//!    The exact bytes they serialize into are pinned by tests through
//!    `serde_json`, which exercises the same serde data model that
//!    `serde_wasm_bindgen` feeds to JavaScript.
//! 2. **Bridge layer** — [`validate_source`], [`supported_languages`],
//!    [`rule_ids`] and [`engine_version`]: `#[wasm_bindgen]` exports that
//!    delegate exclusively to the pure layer plus
//!    `serde_wasm_bindgen::to_value`. They compile on every host build
//!    (`cargo check --features wasm`), but calling them requires a JS runtime:
//!    crossing the interop boundary aborts natively (verified empirically).
//!    End-to-end execution happens in CI against `wasm32-unknown-unknown`
//!    (see this crate's README).
//!
//! No engine logic lives here: analysis always flows through
//! [`crate::engine::analyze`], languages through [`crate::lang::Language`]
//! and findings keep their protocol serialization from [`crate::rules::Finding`]
//! — the JSON line protocol and the WASM surface can never drift apart.
//!
//! Wire contract surfaced to JavaScript (camelCase):
//!
//! ```text
//! validateSource("function f() {}", "typescript")
//!   → { language: "typescript", score: 85,
//!       findings: [{ rule: "EMPTY_FUNCTION", severity: "error",
//!                    line: 1, message: "function 'f' has an empty body" }],
//!       rulesChecked: ["STUB_BODY", …] }
//!
//! validateSource("fn main() {}", "kotlin")
//!   → throws { code: "UNKNOWN_LANGUAGE",
//!              message: "unknown language \"kotlin\": expected …",
//!              supportedLanguages: ["typescript", "python", "go"] }
//! ```

use std::fmt;

use serde::Serialize;
use wasm_bindgen::prelude::*;

use crate::engine::{self, AnalysisResult};
use crate::lang::{Language, UnknownLanguageError};
use crate::protocol::PROTOCOL_VERSION;
use crate::rules::{Finding, RULE_IDS};

/// Stable machine-readable discriminator carried by every rejected call of
/// [`validate_source`] when the language name is outside the contract.
pub const ERR_UNKNOWN_LANGUAGE: &str = "UNKNOWN_LANGUAGE";

/// Discriminator for the defensive path where serializing an otherwise valid
/// response fails (never observed in practice; kept so the bridge stays total).
pub const ERR_SERIALIZATION_FAILED: &str = "SERIALIZATION_FAILED";

/// Typed error handed to JavaScript as the thrown value of a failed
/// [`validate_source`] call. Serialized as a plain object so consumers can
/// branch on [`WasmError::code`] without string parsing.
///
/// ```json
/// { "code": "UNKNOWN_LANGUAGE",
///   "message": "unknown language \"kotlin\": expected \"typescript\", …",
///   "supportedLanguages": ["typescript", "python", "go"] }
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WasmError {
    /// Machine-readable discriminator ([`ERR_UNKNOWN_LANGUAGE`], …).
    pub code: String,
    /// Human-readable explanation that names the offending input and the fix.
    pub message: String,
    /// Accepted spellings, present iff [`WasmError::code`] is
    /// [`ERR_UNKNOWN_LANGUAGE`].
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supported_languages: Option<Vec<String>>,
}

impl WasmError {
    /// Builds the typed error for an unrecognized language name, deriving the
    /// accepted list from [`Language::ALL`] instead of hard-coding it.
    pub fn unknown_language(failure: &UnknownLanguageError) -> Self {
        WasmError {
            code: ERR_UNKNOWN_LANGUAGE.to_string(),
            message: format!(
                "unknown language {:?}: expected {}. Call supportedLanguages() for the live list.",
                failure.raw,
                quoted_language_list(),
            ),
            supported_languages: Some(supported_language_names()),
        }
    }

    /// Defensive fallback used when the happy-path payload itself cannot be
    /// marshaled across the boundary.
    pub fn serialization_failed(context: impl fmt::Display) -> Self {
        WasmError {
            code: ERR_SERIALIZATION_FAILED.to_string(),
            message: format!("failed to serialize validation report for JavaScript: {context}"),
            supported_languages: None,
        }
    }
}

impl fmt::Display for WasmError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for WasmError {}

/// Outcome of a successful [`validate_source`] call, shaped exactly as the JS
/// consumer sees it after `serde_wasm_bindgen` marshaling.
///
/// `findings` reuses [`Finding`]'s protocol serialization verbatim
/// (`rule`, `severity` ∈ {"error","warning"}, 1-based `line`, `message`),
/// mirroring the JSON line protocol one-to-one by construction.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationReport {
    /// Canonical name of the language the source was analyzed as.
    pub language: String,
    /// Quality score in `0..=100`; 100 means no finding reduced it.
    pub score: u32,
    /// Normalized violations ordered by line, then canonical rule order.
    pub findings: Vec<Finding>,
    /// Every heuristic evaluated for the run, in stable protocol order.
    pub rules_checked: Vec<&'static str>,
}

impl ValidationReport {
    /// Maps a raw [`AnalysisResult`] onto the wire shape. Pure function:
    /// identical inputs always produce an identical report.
    pub fn from_analysis(language: Language, result: &AnalysisResult) -> Self {
        ValidationReport {
            language: language.as_str().to_string(),
            score: result.score,
            findings: result.findings.clone(),
            rules_checked: RULE_IDS.to_vec(),
        }
    }
}

/// Parses a raw language name coming from JavaScript into the engine enum,
/// producing a fully typed [`WasmError`] when it is outside the contract.
pub fn parse_language(raw: &str) -> Result<Language, WasmError> {
    raw.parse::<Language>()
        .map_err(|failure| WasmError::unknown_language(&failure))
}

/// Accepted language spellings derived from [`Language::ALL`], in protocol order.
pub fn supported_language_names() -> Vec<String> {
    Language::ALL
        .iter()
        .map(|language| language.as_str().to_string())
        .collect()
}

fn quoted_language_list() -> String {
    Language::ALL
        .iter()
        .map(|language| format!("{:?}", language.as_str()))
        .collect::<Vec<_>>()
        .join(", ")
}

// --------------------------------------------------------------------------
// Bridge layer: thin #[wasm_bindgen] exports. Everything below delegates to
// the pure layer above; none of these functions contains engine logic.
// --------------------------------------------------------------------------

fn marshal_error(error: WasmError) -> JsValue {
    match serde_wasm_bindgen::to_value(&error) {
        Ok(envelope) => envelope,
        // Unreachable for owned strings in practice; keeps the bridge total
        // instead of silently swallowing a serializer failure.
        Err(secondary) => JsValue::from_str(&format!(
            "{error} (error envelope serialization failed: {secondary})"
        )),
    }
}

fn marshal_report(report: &ValidationReport) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(report)
        .map_err(|failure| marshal_error(WasmError::serialization_failed(failure)))
}

/// Validates `source` written in `language` against the seven Quality-Engine
/// heuristics and returns a structured report object.
///
/// # JavaScript
/// ```ts
/// import init, { validateSource } from "./izanagi_core.js";
/// await init();
/// const report = validateSource("function save() {}", "typescript");
/// // { language: "typescript", score: 85, findings: [...], rulesChecked: [...] }
/// try {
///   validateSource("fn main() {}", "kotlin");
/// } catch (error) {
///   // { code: "UNKNOWN_LANGUAGE", message: "…", supportedLanguages: [...] }
/// }
/// ```
#[wasm_bindgen(js_name = validateSource)]
pub fn validate_source(source: &str, language: &str) -> Result<JsValue, JsValue> {
    let parsed = parse_language(language).map_err(marshal_error)?;
    let result = engine::analyze(parsed, source);
    marshal_report(&ValidationReport::from_analysis(parsed, &result))
}

/// Every language accepted by [`validate_source`], in protocol order.
#[wasm_bindgen(js_name = supportedLanguages)]
pub fn supported_languages() -> Vec<String> {
    supported_language_names()
}

/// Stable ids of all heuristics evaluated per validation, in canonical order.
#[wasm_bindgen(js_name = ruleIds)]
pub fn rule_ids() -> Vec<String> {
    RULE_IDS.iter().map(|id| id.to_string()).collect()
}

/// Engine version, matching the `version` op of the JSON line protocol.
#[wasm_bindgen(js_name = engineVersion)]
pub fn engine_version() -> String {
    PROTOCOL_VERSION.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_every_supported_language() {
        assert_eq!(parse_language("typescript"), Ok(Language::TypeScript));
        assert_eq!(parse_language("python"), Ok(Language::Python));
        assert_eq!(parse_language("go"), Ok(Language::Go));
    }

    #[test]
    fn unknown_language_error_is_typed_and_actionable() {
        let error = parse_language("kotlin").unwrap_err();
        assert_eq!(error.code, ERR_UNKNOWN_LANGUAGE);
        assert!(error.message.contains("\"kotlin\""));
        for spelling in ["\"typescript\"", "\"python\"", "\"go\""] {
            assert!(error.message.contains(spelling), "missing {spelling}");
        }
        assert_eq!(
            error.supported_languages,
            Some(vec![
                "typescript".to_string(),
                "python".to_string(),
                "go".to_string(),
            ])
        );
        assert_eq!(
            error.to_string(),
            format!("[{ERR_UNKNOWN_LANGUAGE}] {}", error.message)
        );
        // Case-sensitivity is part of the contract, not an accident.
        let wrong_case = parse_language("TypeScript").unwrap_err();
        assert_eq!(wrong_case.code, ERR_UNKNOWN_LANGUAGE);
    }

    #[test]
    fn clean_report_maps_full_score_with_empty_findings() {
        let source = "func Add(a int, b int) int {\n\treturn a + b\n}\n";
        let result = engine::analyze(Language::Go, source);
        let report = ValidationReport::from_analysis(Language::Go, &result);
        assert_eq!(report.language, "go");
        assert_eq!(report.score, 100);
        assert!(report.findings.is_empty());
        assert_eq!(report.rules_checked, RULE_IDS.to_vec());
    }

    #[test]
    fn stub_report_keeps_protocol_finding_shape() {
        let source = "function ok() {\n  return 1; // TODO make faster\n}\n";
        let result = engine::analyze(Language::TypeScript, source);
        let report = ValidationReport::from_analysis(Language::TypeScript, &result);
        assert!(report.score < 100);
        let stubs: Vec<&Finding> = report
            .findings
            .iter()
            .filter(|finding| finding.rule == "STUB_BODY")
            .collect();
        assert_eq!(stubs.len(), 1);
        assert_eq!(stubs[0].line, 2);
    }

    #[test]
    fn wire_shapes_match_the_documented_js_contract() {
        // serde_json pins the same serde data model handed to JavaScript via
        // serde_wasm_bindgen, so camelCase keys and value encodings are exact.
        let sloppy = "// Generated by CodeSmith\nfunction save(data) {}\n";
        let result = engine::analyze(Language::TypeScript, sloppy);
        let report = ValidationReport::from_analysis(Language::TypeScript, &result);

        let json = serde_json::to_value(&report).expect("report serializes");
        let keys = json
            .as_object()
            .expect("object")
            .keys()
            .cloned()
            .collect::<Vec<_>>();
        assert_eq!(keys.len(), 4);
        for key in ["language", "score", "findings", "rulesChecked"] {
            assert!(keys.iter().any(|present| present == key), "missing {key}");
        }
        assert_eq!(json["language"], "typescript");
        assert_eq!(json["score"], report.score);
        assert_eq!(json["rulesChecked"][0], "STUB_BODY");

        let finding = &json["findings"]
            .as_array()
            .expect("array")
            .iter()
            .find(|finding| finding["rule"] == "AI_WATERMARK")
            .expect("watermark flagged");
        assert_eq!(finding["severity"], "error");
        assert_eq!(finding["line"], 1);
        assert!(finding["message"].as_str().is_some());

        let error = parse_language("py").unwrap_err();
        let error_json = serde_json::to_value(&error).expect("error serializes");
        assert_eq!(error_json["code"], "UNKNOWN_LANGUAGE");
        assert_eq!(error_json["supportedLanguages"][0], "typescript");
        assert!(error_json["message"].as_str().is_some());
    }

    #[test]
    fn serialization_failure_error_carries_context_without_language_list() {
        let error = WasmError::serialization_failed("disk on fire");
        assert_eq!(error.code, ERR_SERIALIZATION_FAILED);
        assert!(error.message.contains("disk on fire"));
        assert_eq!(error.supported_languages, None);

        let json = serde_json::to_value(&error).expect("serializes");
        assert!(json.get("supportedLanguages").is_none());
    }
}
