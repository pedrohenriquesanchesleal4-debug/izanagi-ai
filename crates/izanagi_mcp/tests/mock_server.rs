//! Integration tests running the real client against an in-process mock MCP
//! server connected through OS pipes (`std::io::pipe`), covering the full
//! handshake, tools/list, tools/call, the five reserved JSON-RPC error codes'
//! mapping, timeouts, malformed-frame recovery and peer shutdown.

use std::io::{self, BufReader, BufWriter, Write};
use std::sync::mpsc;
use std::thread::{self, JoinHandle};
use std::time::Duration;

use serde_json::{json, Value};

use izanagi_mcp::{
    decode_frame, encode_frame, ClientInfo, McpClient, McpError, ERR_INTERNAL,
    ERR_INVALID_PARAMS, ERR_INVALID_REQUEST, ERR_METHOD_NOT_FOUND, ERR_PARSE, PROTOCOL_VERSION,
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
                let arguments = frame["params"].get("arguments").cloned().unwrap_or(json!({}));
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
    let client =
        MockClient::new(client_reader, client_writer).with_timeout(Duration::from_millis(timeout_ms));
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
    let result = client.call_tool("echo", arguments.clone()).expect("call ok");
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
