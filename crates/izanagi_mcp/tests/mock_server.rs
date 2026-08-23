//! Integration tests running the real client against an in-process mock MCP
//! server connected through OS pipes (`std::io::pipe`), covering the full
//! handshake, tools/list, tools/call, the five reserved JSON-RPC error codes'
//! mapping, timeouts, malformed-frame recovery and peer shutdown.
//!
//! A second layer exercises the compiled `izanagi-mcp` binary end to end
//! (spawned via Cargo's `CARGO_BIN_EXE_*` mechanism) against out-of-process
//! mock MCP servers written in Python (`python3 -u`, unbuffered stdio). These
//! pin the CLI contract of the `call` subcommand: deterministic NDJSON steps
//! on stdout, typed errors on stderr with non-zero exit, and the reserved-code
//! mapping surviving the whole process boundary.

use std::io::{self, BufReader, BufWriter, Read, Write};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use serde_json::{json, Value};

use izanagi_mcp::{
    decode_frame, encode_frame, ClientInfo, McpClient, McpError, ERR_INTERNAL, ERR_INVALID_PARAMS,
    ERR_INVALID_REQUEST, ERR_METHOD_NOT_FOUND, ERR_PARSE, PROTOCOL_VERSION,
};

type MockClient = McpClient<io::PipeWriter>;

fn spawn_standard_mock(reader: io::PipeReader, writer: io::PipeWriter) -> JoinHandle<()> {
    thread::spawn(move || {
        let mut reader = BufReader::new(reader);
        let mut writer = BufWriter::new(writer);
        let mut buffer = String::new();
        while let Ok(Some(frame)) = decode_frame(&mut reader, &mut buffer) {
            respond_to(&mut writer, &frame);
        }
    })
}

fn respond_to<W: Write>(writer: &mut W, frame: &Value) {
    let id = frame.get("id").and_then(Value::as_u64);
    let method = frame.get("method").and_then(Value::as_str).unwrap_or("");
    let Some(id) = id else {
        return; // notification: nothing to answer
    };
    let response = match method {
        "initialize" => {
            assert_eq!(
                frame["params"]["protocolVersion"].as_str(),
                Some(PROTOCOL_VERSION),
                "client must offer protocolVersion 2025-06-18"
            );
            assert!(frame["params"]["clientInfo"]["name"].is_string());
            json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "protocolVersion": PROTOCOL_VERSION,
                    "capabilities": { "tools": {} },
                    "serverInfo": { "name": "mock-server", "version": "0.2.0" },
                },
            })
        }
        "tools/list" => json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": { "tools": [
                {
                    "name": "echo",
                    "description": "Echoes its arguments back",
                    "inputSchema": {
                        "type": "object",
                        "properties": { "payload": { "type": "string" } },
                    },
                },
            ]},
        }),
        "tools/call" => {
            let name = frame["params"]["name"].as_str().unwrap_or("");
            if name == "echo" {
                let arguments = frame["params"]
                    .get("arguments")
                    .cloned()
                    .unwrap_or(json!({}));
                json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": {
                        "content": [{ "type": "text", "text": arguments.to_string() }],
                        "structuredContent": arguments,
                        "isError": false,
                    },
                })
            } else if name == "bad-args" {
                json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "error": { "code": ERR_INVALID_PARAMS, "message": "arguments failed schema validation" },
                })
            } else if name == "broken-tool" {
                json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "error": { "code": ERR_INTERNAL, "message": "tool exploded" },
                })
            } else {
                json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "error": { "code": ERR_METHOD_NOT_FOUND, "message": format!("tool '{name}' not found") },
                })
            }
        }
        other => json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": { "code": ERR_METHOD_NOT_FOUND, "message": format!("unknown method '{other}'") },
        }),
    };
    let _ = encode_frame(writer, &response);
}

fn standard_client(timeout_ms: u64) -> (MockClient, JoinHandle<()>) {
    let (client_reader, server_writer) = io::pipe().expect("pipe pair 1");
    let (server_reader, client_writer) = io::pipe().expect("pipe pair 2");
    let handle = spawn_standard_mock(server_reader, server_writer);
    let client = MockClient::new(client_reader, client_writer)
        .with_timeout(Duration::from_millis(timeout_ms));
    (client, handle)
}

fn demo_info() -> ClientInfo {
    ClientInfo::new("izanagi-mcp-tests", "0.1.0")
}

#[test]
fn handshake_negotiates_protocol_and_lists_tools() {
    let (mut client, _server) = standard_client(5_000);

    let initialized = client.initialize(demo_info()).expect("handshake ok");
    assert_eq!(initialized["protocolVersion"], PROTOCOL_VERSION);
    assert_eq!(initialized["serverInfo"]["name"], "mock-server");

    let tools = client.list_tools().expect("tools listed");
    assert_eq!(tools.len(), 1);
    assert_eq!(tools[0].name, "echo");
    assert_eq!(
        tools[0].description.as_deref(),
        Some("Echoes its arguments back")
    );
    assert_eq!(tools[0].input_schema["type"], "object");
}

#[test]
fn tool_call_round_trips_arguments() {
    let (mut client, _server) = standard_client(5_000);
    client.initialize(demo_info()).expect("handshake");

    let arguments = json!({ "payload": "ping 🛠" });
    let result = client
        .call_tool("echo", arguments.clone())
        .expect("call ok");
    assert_eq!(result["isError"], false);
    assert_eq!(result["structuredContent"], arguments);
    assert_eq!(result["content"][0]["text"], arguments.to_string());

    let null_arguments_result = client.call_tool("echo", Value::Null).expect("call ok");
    assert_eq!(null_arguments_result["structuredContent"], json!({}));
}

#[test]
fn non_object_arguments_are_rejected_locally() {
    let (mut client, _server) = standard_client(5_000);
    client.initialize(demo_info()).expect("handshake");

    let error = client
        .call_tool("echo", json!([1, 2, 3]))
        .expect_err("array args rejected");
    assert!(matches!(error, McpError::InvalidParams(_)));
    assert_eq!(error.rpc_code(), Some(ERR_INVALID_PARAMS));
}

#[test]
fn server_errors_map_onto_reserved_rpc_codes() {
    struct Case {
        tool: &'static str,
        expected_code: i64,
        matches: fn(&McpError) -> bool,
    }
    let cases = [
        Case {
            tool: "ghost",
            expected_code: ERR_METHOD_NOT_FOUND,
            matches: |error| matches!(error, McpError::MethodNotFound(_)),
        },
        Case {
            tool: "bad-args",
            expected_code: ERR_INVALID_PARAMS,
            matches: |error| matches!(error, McpError::InvalidParams(_)),
        },
        Case {
            tool: "broken-tool",
            expected_code: ERR_INTERNAL,
            matches: |error| matches!(error, McpError::Internal(_)),
        },
    ];
    for case in cases {
        let (mut client, _server) = standard_client(5_000);
        client.initialize(demo_info()).expect("handshake");
        let error = client
            .call_tool(case.tool, json!({}))
            .expect_err("server error expected");
        assert!(
            (case.matches)(&error),
            "{} produced unexpected variant: {error:?}",
            case.tool
        );
        assert_eq!(error.rpc_code(), Some(case.expected_code));
    }
}

#[test]
fn unknown_methods_map_to_method_not_found() {
    let (mut client, _server) = standard_client(5_000);
    client.initialize(demo_info()).expect("handshake");

    let error = client
        .call_tool("resources/read", json!({}))
        .expect_err("mock rejects unknown methods");
    assert!(
        matches!(&error, McpError::MethodNotFound(detail) if detail.contains("resources/read"))
    );
    assert_eq!(error.rpc_code(), Some(ERR_METHOD_NOT_FOUND));
}

#[test]
fn timeout_fires_while_server_stays_silent() {
    let (client_reader, server_writer) = io::pipe().expect("pipes");
    let (server_reader, client_writer) = io::pipe().expect("pipes");
    // Keep the write half alive (no EOF) but never read or answer anything.
    let (ready_tx, ready_rx) = mpsc::channel::<()>();
    let holder = thread::spawn(move || {
        let _writer = server_writer;
        let _keep_reader_open = server_reader;
        let _ = ready_tx.send(());
        thread::sleep(Duration::from_millis(600));
    });
    ready_rx
        .recv_timeout(Duration::from_secs(2))
        .expect("holder started");

    let mut client =
        MockClient::new(client_reader, client_writer).with_timeout(Duration::from_millis(120));
    let error = client
        .initialize(demo_info())
        .expect_err("silent server must time out");
    assert!(matches!(error, McpError::Timeout), "got {error:?}");
    holder.join().expect("holder thread joins");
}

#[test]
fn parse_error_is_reported_and_session_recovers() {
    let (client_reader, mut server_writer) = io::pipe().expect("pipes");
    let (server_reader, client_writer) = io::pipe().expect("pipes");
    // Hand-driven exchange: hold the read half open so our writes cannot fail
    // with EPIPE; nobody consumes request frames here.
    let _hold_reader_open = server_reader;
    let mut client =
        MockClient::new(client_reader, client_writer).with_timeout(Duration::from_secs(5));

    // Phase 1: only a malformed frame — the pending request fails fast with
    // Parse (-32700); the consumed line keeps the stream aligned.
    server_writer
        .write_all(b"\nthis-is-not-json\n")
        .expect("garbage written");
    server_writer.flush().expect("flushed");

    let first = client
        .initialize(demo_info())
        .expect_err("parse error surfaces");
    assert!(matches!(first, McpError::Parse(_)), "got {first:?}");
    assert_eq!(first.rpc_code(), Some(ERR_PARSE));

    // Phase 2: the very next exchange succeeds cleanly (ids advanced to 2).
    server_writer
        .write_all(
            b"{\"jsonrpc\":\"2.0\",\"id\":2,\"result\":{\"protocolVersion\":\"2025-06-18\",\"capabilities\":{},\"serverInfo\":{\"name\":\"m\",\"version\":\"0\"}}}\n",
        )
        .expect("valid response written");
    server_writer.flush().expect("flushed");

    let recovered = client.initialize(demo_info()).expect("session recovers");
    assert_eq!(recovered["protocolVersion"], PROTOCOL_VERSION);
}

#[test]
fn peer_shutdown_surfaces_as_closed_error() {
    let (client_reader, server_writer) = io::pipe().expect("pipes");
    let (server_reader, client_writer) = io::pipe().expect("pipes");
    // Give the client time to write its handshake frame first, then close the
    // read half so the pump observes EOF and reports a closed connection.
    let keeper = thread::spawn(move || {
        thread::sleep(Duration::from_millis(150));
        drop(server_reader);
        let mut writer = server_writer;
        let _ = writer.write_all(b"");
        let _ = writer.flush();
    });

    let mut client =
        MockClient::new(client_reader, client_writer).with_timeout(Duration::from_secs(5));
    let error = client
        .initialize(demo_info())
        .expect_err("peer shutdown must surface");
    assert!(
        matches!(error, McpError::Closed | McpError::Io(_)),
        "got {error:?}"
    );
    keeper.join().expect("keeper joins");
}

#[test]
fn invalid_request_envelopes_surface_as_invalid_request() {
    let (client_reader, mut server_writer) = io::pipe().expect("pipes");
    let (server_reader, client_writer) = io::pipe().expect("pipes");
    // Keep the read half alive so the handshake write cannot fail with EPIPE;
    // nobody consumes it here — that is fine for a hand-driven exchange.
    let _hold_reader_open = server_reader;
    let mut client =
        MockClient::new(client_reader, client_writer).with_timeout(Duration::from_secs(5));

    // A JSON-RPC error response with a null id cannot be attributed to any
    // caller; the client surfaces it immediately as InvalidRequest (-32600).
    server_writer
        .write_all(
            b"{\"jsonrpc\":\"2.0\",\"id\":null,\"error\":{\"code\":-32600,\"message\":\"not a valid request object\"}}\n",
        )
        .expect("envelope written");

    let error = client
        .initialize(demo_info())
        .expect_err("-32600 maps to InvalidRequest");
    assert!(
        matches!(error, McpError::InvalidRequest(_)),
        "got {error:?}"
    );
    assert_eq!(error.rpc_code(), Some(ERR_INVALID_REQUEST));
}

/* ------------------------------------------------------------------------- */
/* Binary end-to-end: the compiled `izanagi-mcp` against real subprocesses   */
/* ------------------------------------------------------------------------- */

/// Full mock MCP server: answers `initialize`, `tools/list` and `tools/call`.
/// `echo` reflects the received `arguments` back as `structuredContent`
/// (proving true wire round-trip); any other tool name is rejected with the
/// reserved `-32601` code, mirroring real MCP servers.
const FULL_SERVER_PY: &str = r#"
import json, sys

for raw in sys.stdin:
    line = raw.strip()
    if not line:
        continue
    frame = json.loads(line)
    if not isinstance(frame.get("id"), int):
        continue  # notification: nothing to answer
    method = frame.get("method")
    if method == "initialize":
        reply = {"jsonrpc": "2.0", "id": frame["id"], "result": {
            "protocolVersion": "2025-06-18",
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "py-mock", "version": "0.1.0"},
        }}
    elif method == "tools/list":
        reply = {"jsonrpc": "2.0", "id": frame["id"], "result": {"tools": [
            {"name": "echo", "description": "Echoes arguments back",
             "inputSchema": {"type": "object"}},
        ]}}
    elif method == "tools/call":
        name = frame.get("params", {}).get("name")
        if name == "echo":
            arguments = frame.get("params", {}).get("arguments")
            reply = {"jsonrpc": "2.0", "id": frame["id"], "result": {
                "content": [{"type": "text", "text": "echo:" + json.dumps(arguments)}],
                "structuredContent": arguments,
                "isError": False,
            }}
        else:
            reply = {"jsonrpc": "2.0", "id": frame["id"], "error": {
                "code": -32601,
                "message": "tool '" + str(name) + "' not found",
            }}
    else:
        reply = {"jsonrpc": "2.0", "id": frame["id"], "error": {
            "code": -32601, "message": "unknown method '" + str(method) + "'",
        }}
    sys.stdout.write(json.dumps(reply) + "\n")
"#;

/// Stays alive holding both pipe halves but never reads or answers anything:
/// every request must die by timeout, never by EOF.
const SILENT_SERVER_PY: &str = "import time; time.sleep(60)";

/// Exits shortly after startup so the pending handshake hits a closed pipe.
const CRASHING_SERVER_PY: &str = "import time; time.sleep(0.05)";

/// Hard ceiling for one binary invocation before the test kills the child.
const CLI_LIMIT: Duration = Duration::from_secs(20);

struct CliRun {
    success: Option<bool>,
    stdout: String,
    stderr: String,
}

/// Runs the compiled binary with piped stdio, collecting both streams on
/// dedicated threads (so a chatty child can never deadlock the test) and
/// enforcing [`CLI_LIMIT`] via polling — no external wait-with-timeout crate.
fn run_izanagi_mcp(arguments: &[&str]) -> CliRun {
    let mut child = Command::new(env!("CARGO_BIN_EXE_izanagi-mcp"))
        .args(arguments)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawns the izanagi-mcp binary");

    let stdout_collector = collect_stream(child.stdout.take());
    let stderr_collector = collect_stream(child.stderr.take());

    let started = Instant::now();
    let mut finished = None;
    while finished.is_none() && started.elapsed() < CLI_LIMIT {
        finished = child.try_wait().expect("polls child status");
        if finished.is_none() {
            thread::sleep(Duration::from_millis(5));
        }
    }
    // Every path must reap the child: kill first when the deadline expired.
    if finished.is_none() {
        let _ = child.kill();
    }
    let _ = child.wait();
    CliRun {
        success: finished.map(|status| status.success()),
        stdout: stdout_collector.join().expect("stdout collector joins"),
        stderr: stderr_collector.join().expect("stderr collector joins"),
    }
}

fn collect_stream<R: Read + Send + 'static>(stream: Option<R>) -> JoinHandle<String> {
    thread::spawn(move || {
        let mut text = String::new();
        if let Some(stream) = stream {
            let _ = BufReader::new(stream).read_to_string(&mut text);
        }
        text
    })
}

/// Parses every non-blank stdout line as JSON, failing with full context when
/// the harness emitted anything that is not an NDJSON step frame.
fn cli_steps(stdout: &str) -> Vec<Value> {
    stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            serde_json::from_str(line)
                .unwrap_or_else(|error| panic!("stdout line is not JSON ({error}): {line}"))
        })
        .collect()
}

fn python_server(script: &'static str) -> [&'static str; 4] {
    ["python3", "-u", "-c", script]
}

#[test]
fn cli_call_round_trips_arguments_through_the_real_binary() {
    let server = python_server(FULL_SERVER_PY);
    let mut arguments = vec![
        "call",
        "--tool=echo",
        r#"--args={"payload":"ping-tool-call-42","count":3}"#,
        "--timeout-ms=5000",
    ];
    arguments.extend_from_slice(&server);
    let run = run_izanagi_mcp(&arguments);

    assert_eq!(
        run.success,
        Some(true),
        "binary must succeed; stderr: {}",
        run.stderr
    );

    let steps = cli_steps(&run.stdout);
    assert_eq!(
        steps.len(),
        2,
        "call mode prints exactly initialize + tools/call steps; got: {}",
        run.stdout
    );

    assert_eq!(steps[0]["step"], "initialize");
    assert_eq!(steps[0]["result"]["protocolVersion"], PROTOCOL_VERSION);
    assert_eq!(steps[0]["result"]["serverInfo"]["name"], "py-mock");

    assert_eq!(steps[1]["step"], "tools/call");
    assert_eq!(steps[1]["result"]["isError"], false);
    // The mock reflects `arguments` verbatim: proves the CLI carried the
    // --args payload across spawn → handshake → tools/call unmodified.
    assert_eq!(
        steps[1]["result"]["structuredContent"],
        json!({ "payload": "ping-tool-call-42", "count": 3 })
    );
}

#[test]
fn cli_call_maps_unknown_tool_to_reserved_code_on_stderr_with_failure_exit() {
    let server = python_server(FULL_SERVER_PY);
    let mut arguments = vec!["call", "--tool=ghost", "--timeout-ms=5000"];
    arguments.extend_from_slice(&server);
    let run = run_izanagi_mcp(&arguments);

    assert_eq!(run.success, Some(false), "unknown tool must fail the run");
    assert!(
        run.stderr.contains("-32601"),
        "stderr must carry the reserved code; got: {}",
        run.stderr
    );
    assert!(
        run.stderr.contains("ghost"),
        "stderr must name the missing tool; got: {}",
        run.stderr
    );

    // Deterministic partial output: steps completed before the failure stay
    // on stdout; nothing after the failed call is printed.
    let steps = cli_steps(&run.stdout);
    assert_eq!(steps.len(), 1, "got: {}", run.stdout);
    assert_eq!(steps[0]["step"], "initialize");
}

#[test]
fn cli_call_against_silent_server_times_out_without_hanging() {
    let started = Instant::now();
    let server = python_server(SILENT_SERVER_PY);
    let mut arguments = vec!["call", "--tool=echo", "--timeout-ms=250"];
    arguments.extend_from_slice(&server);
    let run = run_izanagi_mcp(&arguments);
    let elapsed = started.elapsed();

    assert_eq!(run.success, Some(false), "silent server must fail the run");
    assert!(
        run.stderr.contains("timed out"),
        "stderr must surface the standardized Timeout error; got: {}",
        run.stderr
    );
    assert!(
        elapsed < Duration::from_secs(10),
        "binary must honor --timeout-ms instead of hanging; took {elapsed:?}"
    );
    assert!(
        cli_steps(&run.stdout).is_empty(),
        "no step completes before the timeout; got: {}",
        run.stdout
    );
}

#[test]
fn cli_call_against_crashed_server_reports_transport_failure() {
    let server = python_server(CRASHING_SERVER_PY);
    let mut arguments = vec!["call", "--tool=echo", "--timeout-ms=5000"];
    arguments.extend_from_slice(&server);
    let run = run_izanagi_mcp(&arguments);

    assert_eq!(run.success, Some(false), "crashed server must fail the run");
    let transport_failure =
        run.stderr.contains("closed by peer") || run.stderr.contains("i/o error");
    assert!(
        transport_failure,
        "stderr must surface Closed/Io taxonomy; got: {}",
        run.stderr
    );
}

#[test]
fn cli_call_rejects_invalid_arguments_json_before_spawning_a_server() {
    // Point --args at garbage and the "server" at a program that cannot exist:
    // validation must fire first with an --args-specific message.
    let run = run_izanagi_mcp(&[
        "call",
        "--tool=echo",
        "--args=[not-valid-json",
        "--timeout-ms=1000",
        "/nonexistent/izanagi-mock-server-for-tests",
    ]);

    assert_eq!(run.success, Some(false));
    assert!(
        run.stderr.contains("--args"),
        "validation error must mention --args; got: {}",
        run.stderr
    );
    assert!(
        !run.stderr.contains("failed to spawn"),
        "must reject input before attempting to spawn; got: {}",
        run.stderr
    );
}

#[test]
fn cli_default_invocation_still_performs_handshake_and_tools_list() {
    let server = python_server(FULL_SERVER_PY);
    let mut arguments = vec!["--timeout-ms=5000"];
    arguments.extend_from_slice(&server);
    let run = run_izanagi_mcp(&arguments);

    assert_eq!(
        run.success,
        Some(true),
        "legacy discovery mode must keep working; stderr: {}",
        run.stderr
    );

    let steps = cli_steps(&run.stdout);
    assert_eq!(steps.len(), 2, "got: {}", run.stdout);
    assert_eq!(steps[0]["step"], "initialize");
    assert_eq!(steps[1]["step"], "tools/list");
    assert_eq!(steps[1]["tools"][0]["name"], "echo");
}
