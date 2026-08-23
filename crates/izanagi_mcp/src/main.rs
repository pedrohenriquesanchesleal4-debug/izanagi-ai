//! CLI harness for the `izanagi-mcp` binary.
//!
//! Two modes share one MCP session lifecycle (spawn server → handshake →
//! request → teardown), printing one NDJSON line per completed step on stdout
//! and routing every failure to stderr with a non-zero exit code:
//!
//! ```text
//! # Discovery (default mode):
//! izanagi-mcp [--timeout-ms=N] <server-command> [args…]
//! {"step":"initialize","result":{…}}
//! {"step":"tools/list","tools":[…]}
//!
//! # Tool invocation:
//! izanagi-mcp call --tool=<name> [--args=<json>] [--timeout-ms=N] <server-command> [args…]
//! {"step":"initialize","result":{…}}
//! {"step":"tools/call","result":{…}}
//! ```
//!
//! The first positional argument `call` selects invocation mode; everything
//! after the flags is the server command line, exactly as in default mode.
//! Errors surface as `izanagi-mcp: <message>` on stderr with exit code 1,
//! where `<message>` embeds the typed error's Display (reserved JSON-RPC
//! codes included), e.g. `tools/call failed: method not found (-32601): …`.

use std::io::Write;
use std::process::{Command, ExitCode, Stdio};
use std::time::Duration;

use serde_json::{json, Value};

use izanagi_mcp::{ClientInfo, McpClient};

const USAGE_DISCOVER: &str = "usage: izanagi-mcp [--timeout-ms=N] <server-command> [args…]";
const USAGE_CALL: &str = "usage: izanagi-mcp call --tool=<name> [--args=<json>] [--timeout-ms=N] <server-command> [args…]";

/// How the server is launched once mode-specific flags are peeled off.
struct ServerCommand {
    program: String,
    arguments: Vec<String>,
}

enum Mode {
    /// Legacy behavior: handshake + tools/list.
    Discover,
    /// Handshake + a single tools/call against `--tool` with `--args`.
    Call { tool: String, args: Value },
}

struct Invocation {
    mode: Mode,
    server: ServerCommand,
    timeout_ms: u64,
}

fn parse_invocation() -> Result<Invocation, String> {
    let mut timeout_ms = 15_000u64;
    let mut tool: Option<String> = None;
    let mut args: Option<Value> = None;
    let mut call_mode = false;
    let mut positional: Vec<String> = Vec::new();

    for argument in std::env::args().skip(1) {
        if let Some(value) = argument.strip_prefix("--timeout-ms=") {
            timeout_ms = value
                .parse()
                .map_err(|_| format!("invalid --timeout-ms value: {value}"))?;
        } else if let Some(value) = argument.strip_prefix("--tool=") {
            if value.is_empty() {
                return Err("invalid --tool value: must not be empty".to_string());
            }
            tool = Some(value.to_string());
        } else if let Some(value) = argument.strip_prefix("--args=") {
            let parsed: Value = serde_json::from_str(value)
                .map_err(|error| format!("invalid --args JSON '{value}': {error}"))?;
            if !parsed.is_object() {
                return Err(format!(
                    "invalid --args value '{value}': tool arguments must be a JSON object"
                ));
            }
            args = Some(parsed);
        } else if argument == "call" && positional.is_empty() && !call_mode {
            call_mode = true;
        } else {
            positional.push(argument);
        }
    }

    let Some(program) = positional.first().cloned() else {
        return Err(if call_mode {
            USAGE_CALL.to_string()
        } else {
            USAGE_DISCOVER.to_string()
        });
    };
    let server = ServerCommand {
        program,
        arguments: positional[1..].to_vec(),
    };

    let mode = if call_mode {
        let Some(tool) = tool else {
            return Err(format!("missing required --tool=<name>\n{USAGE_CALL}"));
        };
        Mode::Call {
            tool,
            args: args.unwrap_or_else(|| json!({})),
        }
    } else {
        Mode::Discover
    };

    Ok(Invocation {
        mode,
        server,
        timeout_ms,
    })
}

fn run() -> Result<(), String> {
    let invocation = parse_invocation()?;
    let ServerCommand { program, arguments } = &invocation.server;

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

        match &invocation.mode {
            Mode::Discover => {
                let tools = client
                    .list_tools()
                    .map_err(|error| format!("tools/list failed: {error}"))?;
                println!("{}", json!({ "step": "tools/list", "tools": tools }));
            }
            Mode::Call { tool, args } => {
                let result = client
                    .call_tool(tool, args.clone())
                    .map_err(|error| format!("tools/call failed: {error}"))?;
                println!("{}", json!({ "step": "tools/call", "result": result }));
            }
        }
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
