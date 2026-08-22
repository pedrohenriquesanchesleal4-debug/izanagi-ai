//! stdin/stdout entrypoint of the `izanagi-core` Quality Engine.
//!
//! Reads newline-delimited JSON requests until EOF and answers one response
//! per line. A transport failure (broken pipe) is the only fatal condition;
//! malformed requests are answered inline as structured errors.

use std::io::{self, Write};
use std::process::ExitCode;

fn main() -> ExitCode {
    let stdin = io::stdin();
    let stdout = io::stdout();
    match izanagi_core::protocol::run(stdin.lock(), stdout.lock()) {
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
