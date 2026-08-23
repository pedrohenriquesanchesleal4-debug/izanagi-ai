//! JSON-RPC 2.0 client for the Model Context Protocol over newline-delimited
//! stdio frames.
//!
//! The client is generic over reader/writer so tests can run it against
//! in-memory duplexes; the `izanagi-mcp` binary wires it to a spawned child
//! process' stdin/stdout. A dedicated pump thread decodes incoming frames and
//! routes responses to pending requests; every request is bounded by a
//! configurable timeout.

use std::collections::VecDeque;
use std::io::{BufReader, Read, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::codec::{decode_frame, encode_frame};
use crate::error::{map_jsonrpc_error, McpError, ERR_INVALID_REQUEST};

/// Protocol version offered during the `initialize` handshake.
pub const PROTOCOL_VERSION: &str = "2025-06-18";

const DEFAULT_TIMEOUT: Duration = Duration::from_secs(15);

/// Client identity advertised to the server during initialization.
#[derive(Debug, Clone, Serialize)]
pub struct ClientInfo {
    pub name: String,
    pub version: String,
}

impl ClientInfo {
    pub fn new(name: impl Into<String>, version: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            version: version.into(),
        }
    }
}

/// A tool advertised by the server through `tools/list`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(rename = "inputSchema", default)]
    pub input_schema: Value,
}

/// MCP client over any byte transport. Requests are serialized (one at a time)
/// and each waits at most [`McpClient::configured_timeout`] for its response.
/// The reader half is consumed by a dedicated pump thread at construction, so
/// only the writer stays on the struct.
pub struct McpClient<W: Write> {
    writer: Mutex<W>,
    inbox: mpsc::Receiver<Result<Value, McpError>>,
    notifications: Arc<Mutex<VecDeque<Value>>>,
    timeout: Duration,
    next_id: AtomicU64,
    _pump_thread: JoinHandle<()>,
}

impl<W: Write> McpClient<W> {
    /// Spawns the frame-pump thread and wraps the transport halves.
    pub fn new<R: Read + Send + 'static>(reader: R, writer: W) -> Self {
        let (sender, inbox) = mpsc::channel();
        let notifications: Arc<Mutex<VecDeque<Value>>> = Arc::default();
        let queue = Arc::clone(&notifications);
        let pump_thread = thread::spawn(move || pump_frames(reader, sender, queue));
        Self {
            writer: Mutex::new(writer),
            inbox,
            notifications,
            timeout: DEFAULT_TIMEOUT,
            next_id: AtomicU64::new(1),
            _pump_thread: pump_thread,
        }
    }

    /// Overrides the per-request timeout.
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    pub fn configured_timeout(&self) -> Duration {
        self.timeout
    }

    /// Full MCP handshake: sends the `initialize` request carrying
    /// [`PROTOCOL_VERSION`], then the `notifications/initialized` notification.
    /// Returns the server's initialize result verbatim.
    pub fn initialize(&mut self, client_info: ClientInfo) -> Result<Value, McpError> {
        let params = json!({
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {},
            "clientInfo": client_info,
        });
        let result = self.request("initialize", Some(params))?;
        self.notify("notifications/initialized", None)?;
        Ok(result)
    }

    /// Lists the tools the server exposes.
    pub fn list_tools(&mut self) -> Result<Vec<Tool>, McpError> {
        let result = self.request("tools/list", Some(json!({})))?;
        let tools_value = result.get("tools").cloned().unwrap_or_else(|| json!([]));
        serde_json::from_value(tools_value)
            .map_err(|error| McpError::Internal(format!("malformed tools/list payload: {error}")))
    }

    /// Calls a tool by name with object arguments; returns the raw result
    /// object (`isError` included when the tool reports in-band failure).
    pub fn call_tool(&mut self, name: &str, arguments: Value) -> Result<Value, McpError> {
        if !arguments.is_object() && !arguments.is_null() {
            return Err(McpError::InvalidParams(
                "tool arguments must be a JSON object".to_string(),
            ));
        }
        let arguments = if arguments.is_null() {
            json!({})
        } else {
            arguments
        };
        self.request(
            "tools/call",
            Some(json!({ "name": name, "arguments": arguments })),
        )
    }

    /// Drains notifications that arrived while no request was being awaited.
    pub fn drain_notifications(&self) -> Vec<Value> {
        self.notifications().drain(..).collect()
    }

    fn notifications(&self) -> std::sync::MutexGuard<'_, VecDeque<Value>> {
        self.notifications
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn writer(&self) -> std::sync::MutexGuard<'_, W> {
        self.writer
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn request(&mut self, method: &str, params: Option<Value>) -> Result<Value, McpError> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let mut frame = json!({ "jsonrpc": "2.0", "id": id, "method": method });
        if let Some(params) = params {
            frame["params"] = params;
        }
        encode_frame(&mut *self.writer(), &frame)?;

        let deadline = Instant::now() + self.timeout;
        loop {
            let remaining = deadline
                .checked_duration_since(Instant::now())
                .ok_or(McpError::Timeout)?;
            let outcome = match self.inbox.recv_timeout(remaining) {
                Ok(Ok(response)) => {
                    if response.get("id").and_then(Value::as_u64) != Some(id) {
                        self.notifications().push_back(response);
                        continue;
                    }
                    if let Some(error) = response.get("error") {
                        Err(map_jsonrpc_error(error))
                    } else {
                        Ok(response.get("result").cloned().unwrap_or(Value::Null))
                    }
                }
                Ok(Err(error)) => Err(error),
                Err(mpsc::RecvTimeoutError::Timeout) => Err(McpError::Timeout),
                Err(mpsc::RecvTimeoutError::Disconnected) => Err(McpError::Closed),
            };
            return outcome;
        }
    }

    fn notify(&mut self, method: &str, params: Option<Value>) -> Result<(), McpError> {
        let mut frame = json!({ "jsonrpc": "2.0", "method": method });
        if let Some(params) = params {
            frame["params"] = params;
        }
        encode_frame(&mut *self.writer(), &frame)?;
        Ok(())
    }
}

fn pump_frames<R: Read>(
    reader: R,
    sender: mpsc::Sender<Result<Value, McpError>>,
    notifications: Arc<Mutex<VecDeque<Value>>>,
) {
    let mut reader = BufReader::new(reader);
    let mut buffer = String::new();
    loop {
        match decode_frame(&mut reader, &mut buffer) {
            Ok(Some(frame)) => {
                if route_frame(frame, &sender, &notifications) {
                    break;
                }
            }
            Ok(None) => {
                let _ = sender.send(Err(McpError::Closed));
                break;
            }
            Err(crate::codec::FrameError::Malformed(detail)) => {
                // The malformed line has been consumed; report it (-32700
                // semantics) and keep reading so one bad frame does not
                // poison the whole session.
                if sender.send(Err(McpError::Parse(detail))).is_err() {
                    break;
                }
            }
            Err(crate::codec::FrameError::Io(error)) => {
                let _ = sender.send(Err(McpError::Io(error)));
                break;
            }
        }
    }
}

/// Routes one inbound frame. Returns `true` when the pump should shut down
/// (client dropped). Responses go to the pending request; notifications and
/// anything uncorrelatable land in the notification queue; a JSON-RPC
/// response carrying a null id cannot be attributed to any caller and is
/// surfaced immediately as `InvalidRequest`, per RFC semantics.
fn route_frame(
    frame: Value,
    sender: &mpsc::Sender<Result<Value, McpError>>,
    notifications: &Mutex<VecDeque<Value>>,
) -> bool {
    if frame.get("method").is_some() {
        enqueue(notifications, frame);
        return false;
    }
    let has_id_key = frame.get("id").is_some();
    if !has_id_key {
        enqueue(notifications, frame);
        return false;
    }
    if frame.get("id") == Some(&Value::Null) {
        let error = frame.get("error").cloned().unwrap_or_else(|| {
            json!({
                "code": ERR_INVALID_REQUEST,
                "message": "response without a correlatable id",
            })
        });
        return sender.send(Err(map_jsonrpc_error(&error))).is_err();
    }
    if frame.get("result").is_some() || frame.get("error").is_some() {
        return sender.send(Ok(frame)).is_err();
    }
    enqueue(notifications, frame);
    false
}

fn enqueue(notifications: &Mutex<VecDeque<Value>>, frame: Value) {
    notifications
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .push_back(frame);
}
