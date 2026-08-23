//! Entrypoint of the `izanagi-core` binary.
//!
//! Two modes, selected by argv:
//!
//! 1. **Protocol mode** (no arguments): reads newline-delimited JSON requests
//!    from stdin until EOF and answers one response per line. A transport
//!    failure (broken pipe) is the only fatal condition; malformed requests
//!    are answered inline as structured errors.
//! 2. **Scan mode** (`scan-rationalizations`): scans one text blob through the
//!    Anti-Rationalization Engine and prints a single NDJSON line
//!    `{"clean":bool,"findings":[…]}`. The blob comes from `--file=<path>`
//!    (or `--file <path>`) or from stdin via `--stdin`.
//!
//! Exit codes: `0` success/clean · `1` rationalizations detected (gate
//! semantics for CI) · `2` usage or operational failure.
//!
//! ```text
//! $ echo '{"op":"version"}' | izanagi-core
//! {"ok":true,"version":"0.1.0"}
//! $ izanagi-core scan-rationalizations --file=agent-output.md
//! {"clean":false,"findings":[{"pattern_id":"ENG-STUB-MARKER",…}]}   # exit 1
//! ```

use std::io::{self, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use izanagi_core::protocol;
use izanagi_core::rationalizations::{self, ScanReport};

const USAGE: &str = "\
izanagi-core — Izanagi Quality Engine

USAGE:
    izanagi-core                                  NDJSON protocol on stdin/stdout (default)
    izanagi-core scan-rationalizations --file=<path>
    izanagi-core scan-rationalizations --file <path>
    izanagi-core scan-rationalizations --stdin    scan all of stdin instead of a file
    izanagi-core version | --version | -V         print engine version
    izanagi-core help | --help | -h               print this help

SCAN OUTPUT:
    One NDJSON line: {\"clean\":bool,\"findings\":[{pattern_id,category,severity,excerpt,line}]}
    Exit codes: 0 clean · 1 findings detected · 2 usage/operational failure";

/// What the binary should do once argv is parsed.
#[derive(Debug, PartialEq, Eq)]
enum Action {
    /// Legacy NDJSON protocol loop (default).
    Protocol,
    /// Anti-Rationalization scan over one source blob.
    ScanRationalizations(ScanSource),
    /// Print usage and succeed.
    Help,
    /// Print the engine version and succeed.
    Version,
}

/// Where the scanned text comes from.
#[derive(Debug, PartialEq, Eq)]
enum ScanSource {
    Stdin,
    File(PathBuf),
}

/// Pure argv parsing so every accepted/rejected shape is unit-testable.
fn parse_args(args: &[String]) -> Result<Action, String> {
    let Some(head) = args.first() else {
        return Ok(Action::Protocol);
    };
    match head.as_str() {
        "help" | "--help" | "-h" => return Ok(Action::Help),
        "version" | "--version" | "-V" | "-v" => return Ok(Action::Version),
        "scan-rationalizations" => {}
        other => return Err(format!("unknown subcommand {other:?}")),
    }

    let flags = &args[1..];
    match flags.first().map(String::as_str) {
        Some("--stdin") if flags.len() == 1 => Ok(Action::ScanRationalizations(ScanSource::Stdin)),
        Some("--file") if flags.len() == 2 => Ok(Action::ScanRationalizations(ScanSource::File(
            PathBuf::from(&flags[1]),
        ))),
        Some(flag) if flag.starts_with("--file=") && flags.len() == 1 => {
            let path = flag.strip_prefix("--file=").unwrap_or_default();
            if path.is_empty() {
                Err("empty path after --file=".to_string())
            } else {
                Ok(Action::ScanRationalizations(ScanSource::File(
                    PathBuf::from(path),
                )))
            }
        }
        _ => Err(
            "scan-rationalizations requires exactly one source: --file=<path>, \
             --file <path> or --stdin"
                .to_string(),
        ),
    }
}

fn read_scan_source(source: &ScanSource) -> io::Result<String> {
    match source {
        ScanSource::Stdin => io::read_to_string(io::stdin()),
        ScanSource::File(path) => std::fs::read_to_string(path),
    }
}

/// Runs scan mode; the returned code is 0 when clean, 1 when findings exist.
fn run_scan(source: &ScanSource) -> ExitCode {
    let text = match read_scan_source(source) {
        Ok(text) => text,
        Err(error) => {
            eprintln!("izanagi-core: cannot read scan source: {error}");
            return ExitCode::from(2);
        }
    };
    let report: ScanReport = rationalizations::scan_text(&text);
    let stdout = io::stdout();
    let mut writer = stdout.lock();
    let outcome = serde_json::to_string(&report)
        .map_err(std::io::Error::other)
        .and_then(|line| {
            writeln!(writer, "{line}")?;
            writer.flush()
        });
    if let Err(error) = outcome {
        eprintln!("izanagi-core: output failure: {error}");
        return ExitCode::FAILURE;
    }
    if report.clean {
        ExitCode::SUCCESS
    } else {
        ExitCode::from(1)
    }
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let action = match parse_args(&args) {
        Ok(action) => action,
        Err(reason) => {
            eprintln!("izanagi-core: {reason}\n\n{USAGE}");
            return ExitCode::from(2);
        }
    };

    match action {
        Action::Help => {
            println!("{USAGE}");
            ExitCode::SUCCESS
        }
        Action::Version => {
            println!("izanagi-core {}", izanagi_core::PROTOCOL_VERSION);
            ExitCode::SUCCESS
        }
        Action::Protocol => {
            let stdin = io::stdin();
            let stdout = io::stdout();
            match protocol::run(stdin.lock(), stdout.lock()) {
                Ok(()) => {
                    let _ = io::stdout().flush();
                    ExitCode::SUCCESS
                }
                Err(error) => {
                    eprintln!("izanagi-core: transport failure: {error}");
                    ExitCode::FAILURE
                }
            }
        }
        Action::ScanRationalizations(source) => run_scan(&source),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(ToString::to_string).collect()
    }

    #[test]
    fn no_arguments_selects_the_protocol_loop() {
        assert_eq!(parse_args(&[]), Ok(Action::Protocol));
    }

    #[test]
    fn help_and_version_accept_all_spellings() {
        for spelling in ["help", "--help", "-h"] {
            assert_eq!(parse_args(&args(&[spelling])), Ok(Action::Help));
        }
        for spelling in ["version", "--version", "-V", "-v"] {
            assert_eq!(parse_args(&args(&[spelling])), Ok(Action::Version));
        }
    }

    #[test]
    fn scan_source_forms_are_accepted() {
        assert_eq!(
            parse_args(&args(&["scan-rationalizations", "--stdin"])),
            Ok(Action::ScanRationalizations(ScanSource::Stdin))
        );
        assert_eq!(
            parse_args(&args(&["scan-rationalizations", "--file=/tmp/a.txt"])),
            Ok(Action::ScanRationalizations(ScanSource::File(
                PathBuf::from("/tmp/a.txt")
            )))
        );
        assert_eq!(
            parse_args(&args(&["scan-rationalizations", "--file", "/tmp/b.txt"])),
            Ok(Action::ScanRationalizations(ScanSource::File(
                PathBuf::from("/tmp/b.txt")
            )))
        );
    }

    #[test]
    fn malformed_scan_invocations_are_rejected_with_reasons() {
        // Missing source entirely.
        assert!(parse_args(&args(&["scan-rationalizations"])).is_err());
        // Extra positional junk.
        assert!(parse_args(&args(&["scan-rationalizations", "--stdin", "extra"])).is_err());
        // Empty --file= value.
        assert!(parse_args(&args(&["scan-rationalizations", "--file="])).is_err());
        // Dangling --file without value.
        assert!(parse_args(&args(&["scan-rationalizations", "--file"])).is_err());
        // Unknown subcommand names the offender.
        let error = parse_args(&args(&["teleport"])).unwrap_err();
        assert!(error.contains("teleport"));
    }
}
