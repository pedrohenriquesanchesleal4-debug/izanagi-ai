//! JSON line-delimited protocol: one request per line, one response per line,
//! terminating at EOF.
//!
//! Wire contract (validated strictly at the boundary through serde — no type
//! assertions, no lenient parsing):
//!
//! ```text
//! → {"op":"validate","language":"typescript","code":"…"}
//! ← {"ok":true,"score":85,"findings":[{"rule":"STUB_BODY","severity":"error","line":1,"message":"…"}]}
//! → {"op":"rules"}
//! ← {"ok":true,"rules":["STUB_BODY", …]}
//! → {"op":"version"}
//! ← {"ok":true,"version":"0.1.0"}
//! → {"op":"scan-rationalizations","text":"…"}
//! ← {"ok":true,"clean":false,"findings":[{"pattern_id":"ENG-STUB-MARKER","category":"engineering",
//!                                         "severity":"blocker","excerpt":"// TODO: implement later","line":1}]}
//! → anything malformed
//! ← {"ok":false,"error":"…"}
//! ```
//!
//! Blank lines carry no request and are skipped without emitting a response.

use std::io::{BufRead, BufWriter, Write};

use serde::{Deserialize, Serialize};

use crate::engine;
use crate::lang::Language;
use crate::rationalizations::{self, RationalizationFinding};
use crate::rules::{Finding, RULE_IDS};

/// Engine version reported by the `version` operation.
pub const PROTOCOL_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Deserialize)]
#[serde(tag = "op")]
enum Request {
    #[serde(rename = "validate")]
    Validate { language: Language, code: String },
    #[serde(rename = "rules")]
    Rules,
    #[serde(rename = "version")]
    Version,
    #[serde(rename = "scan-rationalizations")]
    ScanRationalizations { text: String },
}

#[derive(Serialize)]
struct Response {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    score: Option<u32>,
    /// Quality-Engine findings (`validate` op only).
    #[serde(rename = "findings", skip_serializing_if = "Option::is_none")]
    quality_findings: Option<Vec<Finding>>,
    /// Anti-Rationalization findings (`scan-rationalizations` op only); the
    /// two finding lists are mutually exclusive per operation, so the shared
    /// wire key never collides.
    #[serde(rename = "findings", skip_serializing_if = "Option::is_none")]
    rationalization_findings: Option<Vec<RationalizationFinding>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    clean: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    rules: Option<Vec<&'static str>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

impl Response {
    fn success() -> Self {
        Self {
            ok: true,
            score: None,
            quality_findings: None,
            rationalization_findings: None,
            clean: None,
            rules: None,
            version: None,
            error: None,
        }
    }

    fn failure(message: impl Into<String>) -> Self {
        Self {
            ok: false,
            score: None,
            quality_findings: None,
            rationalization_findings: None,
            clean: None,
            rules: None,
            version: None,
            error: Some(message.into()),
        }
    }
}

/// Handles a single request line. Returns `None` for blank lines (nothing to
/// answer); every other input yields exactly one response string, including
/// malformed payloads.
pub fn handle_request(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    let response = match serde_json::from_str::<Request>(trimmed) {
        Ok(Request::Validate { language, code }) => {
            let result = engine::analyze(language, &code);
            Response {
                score: Some(result.score),
                quality_findings: Some(result.findings),
                ..Response::success()
            }
        }
        Ok(Request::Rules) => Response {
            rules: Some(RULE_IDS.to_vec()),
            ..Response::success()
        },
        Ok(Request::Version) => Response {
            version: Some(PROTOCOL_VERSION),
            ..Response::success()
        },
        Ok(Request::ScanRationalizations { text }) => {
            let report = rationalizations::scan_text(&text);
            Response {
                clean: Some(report.clean),
                rationalization_findings: Some(report.findings),
                ..Response::success()
            }
        }
        Err(parse_error) => Response::failure(format!("invalid request: {parse_error}")),
    };

    Some(serialize_response(response))
}

/// Serialization can only fail on a broken `Serializer`; fall back to a fixed
/// error envelope so the loop below can never panic on the wire.
fn serialize_response(response: Response) -> String {
    serde_json::to_string(&response).unwrap_or_else(|_| {
        "{\"ok\":false,\"error\":\"response serialization failed\"}".to_string()
    })
}

/// Reads newline-delimited requests until EOF, writing exactly one response
/// line per non-blank request. Invalid UTF-8 and malformed JSON both become
/// structured error responses instead of aborting the session.
pub fn run<R: std::io::Read, W: std::io::Write>(input: R, output: W) -> std::io::Result<()> {
    let mut reader = std::io::BufReader::new(input);
    let mut writer = BufWriter::new(output);
    let mut raw_line = Vec::new();
    loop {
        raw_line.clear();
        if reader.read_until(b'\n', &mut raw_line)? == 0 {
            break;
        }
        while matches!(raw_line.last(), Some(b'\n') | Some(b'\r')) {
            raw_line.pop();
        }
        let line = String::from_utf8_lossy(&raw_line);
        if let Some(response) = handle_request(&line) {
            writeln!(writer, "{response}")?;
            writer.flush()?;
        }
    }
    writer.flush()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn respond(payload: &str) -> serde_json::Value {
        serde_json::from_str(&handle_request(payload).expect("non-blank line"))
            .expect("response is valid json")
    }

    #[test]
    fn validate_returns_scored_findings_for_typescript() {
        let response =
            respond(r#"{"op":"validate","language":"typescript","code":"function f() {}"}"#);
        assert_eq!(response["ok"], true);
        let score = response["score"].as_u64().expect("numeric score");
        assert!(score < 100);
        let finding = &response["findings"][0];
        assert_eq!(finding["rule"], "EMPTY_FUNCTION");
        assert_eq!(finding["severity"], "error");
        assert_eq!(finding["line"], 1);
        assert!(finding["message"].as_str().expect("message").contains('f'));
    }

    #[test]
    fn validate_works_for_python_and_go() {
        let python =
            respond(r#"{"op":"validate","language":"python","code":"def f():\n    pass\n"}"#);
        assert_eq!(python["ok"], true);
        assert!(python["findings"]
            .as_array()
            .expect("findings array")
            .iter()
            .any(|finding| finding["rule"] == "STUB_BODY"));

        let go = respond(
            r#"{"op":"validate","language":"go","code":"func Run() {\n\t_ = recover()\n}\n"}"#,
        );
        assert_eq!(go["ok"], true);
        assert!(go["findings"]
            .as_array()
            .expect("findings array")
            .iter()
            .any(|finding| finding["rule"] == "GENERIC_CATCH"));
    }

    #[test]
    fn clean_code_scores_perfect_with_empty_findings() {
        let response = respond(
            r#"{"op":"validate","language":"go","code":"func Add(a int, b int) int {\n\treturn a + b\n}\n"}"#,
        );
        assert_eq!(response["score"], 100);
        assert_eq!(response["findings"].as_array().expect("array").len(), 0);
    }

    #[test]
    fn invalid_json_yields_structured_error() {
        let response = respond("{not json");
        assert_eq!(response["ok"], false);
        assert!(response["error"]
            .as_str()
            .expect("error")
            .starts_with("invalid request"));
    }

    #[test]
    fn unknown_language_is_rejected_by_contract() {
        let response = respond(r#"{"op":"validate","language":"rust","code":"fn main() {}"}"#);
        assert_eq!(response["ok"], false);
        let message = response["error"].as_str().expect("error");
        assert!(message.contains("unknown language"));
        assert!(message.contains("typescript"));
    }

    #[test]
    fn missing_fields_are_rejected() {
        let no_code = respond(r#"{"op":"validate","language":"go"}"#);
        assert_eq!(no_code["ok"], false);

        let unknown_op = respond(r#"{"op":"teleport"}"#);
        assert_eq!(unknown_op["ok"], false);
    }

    #[test]
    fn rules_operation_lists_all_seven_ids_in_order() {
        let response = respond(r#"{"op":"rules"}"#);
        assert_eq!(response["ok"], true);
        let ids: Vec<&str> = response["rules"]
            .as_array()
            .expect("rules array")
            .iter()
            .map(|value| value.as_str().expect("string id"))
            .collect();
        assert_eq!(
            ids,
            vec![
                "STUB_BODY",
                "EMPTY_FUNCTION",
                "GENERIC_CATCH",
                "GENERIC_NAME",
                "REDUNDANT_COMMENT",
                "AI_WATERMARK",
                "LONG_FUNCTION",
            ]
        );
    }

    #[test]
    fn version_operation_reports_crate_version() {
        let response = respond(r#"{"op":"version"}"#);
        assert_eq!(response["ok"], true);
        assert_eq!(response["version"], PROTOCOL_VERSION);
    }

    #[test]
    fn blank_lines_are_silently_skipped() {
        assert_eq!(handle_request(""), None);
        assert_eq!(handle_request("   \r\n"), None);
    }

    #[test]
    fn transport_loop_survives_mixed_traffic_until_eof() {
        let input = concat!(
            r#"{"op":"version"}"#,
            "\n",
            "\n",
            "garbage line",
            "\n",
            r#"{"op":"validate","language":"typescript","code":"function g() {}"}"#,
            "\n",
        );
        let mut wire = Vec::new();
        run(Cursor::new(input.as_bytes()), &mut wire).expect("transport succeeds");
        let text = String::from_utf8(wire).expect("utf-8 wire");
        let lines: Vec<&str> = text.lines().collect();
        assert_eq!(lines.len(), 3);
        assert!(lines[0].contains("\"version\""));
        assert!(lines[1].starts_with("{\"ok\":false"));
        assert!(lines[2].contains("\"score\""));
    }
}
