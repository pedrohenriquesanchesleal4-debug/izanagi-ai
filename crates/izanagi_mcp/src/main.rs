//! CLI harness for the `izanagi-mcp` binary.
//!
//! Spawns an MCP server from argv, performs the full handshake (`initialize`
//! + `notifications/initialized` + `tools/list`) and prints one NDJSON line
//! per step on stdout:
//!
//! ```text
//! {"step":"initialize","result":{…}}
//! {"step":"tools/list","tools":[…]}
//! ```
//!
//! Usage: `izanagi-mcp [--timeout-ms=N] <server-command> [args…]`

use std::io::Write;
use std::process::{Command, ExitCode, Stdio};
use std::time::Duration;

use serde_json::json;

use izanagi_mcp::{ClientInfo, McpClient};

struct Invocation {
    command: Vec<String>,
    timeout_ms: u64,
}

fn parse_invocation() -> Result<Invocation, String> {
    let mut command = Vec::new();
    let mut timeout_ms = 15_000u64;
    for argument in std::env::args().skip(1) {
        if let Some(value) = argument.strip_prefix("--timeout-ms=") {
            timeout_ms = value
                .parse()
                .map_err(|_| format!("invalid --timeout-ms value: {value}"))?;
        } else {
            command.push(argument);
        }
    }
    if command.is_empty() {
        return Err("usage: izanagi-mcp [--timeout-ms=N] <server-command> [args…]".to_string());
    }
    Ok(Invocation {
        command,
        timeout_ms,
    })
}

fn run() -> Result<(), String> {
    let invocation = parse_invocation()?;
    let (program, arguments) = invocation.command.split_first().ok_or_else(|| {
        "usage: izanagi-mcp [--timeout-ms=N] <server-command> [args…]".to_string()
    })?;

    let mut child = Command::new(program)
        .args(arguments)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|error| format!("failed to spawn server '{program}': {error}"))?;

    let server_stdout = child
        .stdout
        .take()
        .ok_or_else(|| "server stdout unavailable".to_string())?;
    let server_stdin = child
        .stdin
        .take()
        .ok_or_else(|| "server stdin unavailable".to_string())?;

    let outcome = (|| -> Result<(), String> {
        let mut client = McpClient::new(server_stdout, server_stdin)
            .with_timeout(Duration::from_millis(invocation.timeout_ms));

        let info = ClientInfo::new("izanagi-mcp", izanagi_mcp::CRATE_VERSION);
        let initialize_result = client
            .initialize(info)
            .map_err(|error| format!("handshake failed: {error}"))?;
        println!(
            "{}",
            json!({ "step": "initialize", "result": initialize_result })
        );

        let tools = client
            .list_tools()
            .map_err(|error| format!("tools/list failed: {error}"))?;
        println!("{}", json!({ "step": "tools/list", "tools": tools }));
        io_flush();
        Ok(())
    })();

    let _ = child.kill();
    let _ = child.wait();
    outcome
}

fn io_flush() {
    let _ = std::io::stdout().flush();
}

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("izanagi-mcp: {message}");
            ExitCode::FAILURE
        }
    }
}
