//! Error taxonomy mapping JSON-RPC 2.0 reserved codes onto typed variants.

use std::fmt;

/// Invalid JSON was received (JSON-RPC reserved code `-32700`).
pub const ERR_PARSE: i64 = -32700;
/// The JSON is valid but not a valid Request object (`-32600`).
pub const ERR_INVALID_REQUEST: i64 = -32600;
/// The method does not exist or is not available (`-32601`).
pub const ERR_METHOD_NOT_FOUND: i64 = -32601;
/// Invalid method parameter(s) (`-32602`).
pub const ERR_INVALID_PARAMS: i64 = -32602;
/// Internal JSON-RPC error (`-32603`).
pub const ERR_INTERNAL: i64 = -32603;

/// Every failure mode of the MCP client.
#[derive(Debug)]
pub enum McpError {
    /// Underlying transport I/O failure.
    Io(std::io::Error),
    /// A frame arrived that is not valid JSON (`-32700`).
    Parse(String),
    /// A frame was JSON but not a usable JSON-RPC message (`-32600`).
    InvalidRequest(String),
    /// The server reported an unknown method (`-32601`).
    MethodNotFound(String),
    /// The server rejected the call parameters (`-32602`).
    InvalidParams(String),
    /// The server reported an internal error (`-32603`).
    Internal(String),
    /// Server-defined error outside the reserved code range.
    Server { code: i64, message: String },
    /// No response arrived within the configured timeout.
    Timeout,
    /// The peer closed the connection.
    Closed,
}

impl McpError {
    /// Builds the variant matching a JSON-RPC error `code`.
    pub fn from_rpc_code(code: i64, message: impl Into<String>) -> Self {
        let message = message.into();
        match code {
            ERR_PARSE => McpError::Parse(message),
            ERR_INVALID_REQUEST => McpError::InvalidRequest(message),
            ERR_METHOD_NOT_FOUND => McpError::MethodNotFound(message),
            ERR_INVALID_PARAMS => McpError::InvalidParams(message),
            ERR_INTERNAL => McpError::Internal(message),
            other => McpError::Server {
                code: other,
                message,
            },
        }
    }

    /// The JSON-RPC error code this failure maps to, when any.
    pub fn rpc_code(&self) -> Option<i64> {
        match self {
            McpError::Parse(_) => Some(ERR_PARSE),
            McpError::InvalidRequest(_) => Some(ERR_INVALID_REQUEST),
            McpError::MethodNotFound(_) => Some(ERR_METHOD_NOT_FOUND),
            McpError::InvalidParams(_) => Some(ERR_INVALID_PARAMS),
            McpError::Internal(_) => Some(ERR_INTERNAL),
            McpError::Server { code, .. } => Some(*code),
            McpError::Io(_) | McpError::Timeout | McpError::Closed => None,
        }
    }
}

impl fmt::Display for McpError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            McpError::Io(error) => write!(f, "transport i/o error: {error}"),
            McpError::Parse(detail) => write!(f, "unparseable frame (-32700): {detail}"),
            McpError::InvalidRequest(detail) => write!(f, "invalid request (-32600): {detail}"),
            McpError::MethodNotFound(detail) => write!(f, "method not found (-32601): {detail}"),
            McpError::InvalidParams(detail) => write!(f, "invalid params (-32602): {detail}"),
            McpError::Internal(detail) => write!(f, "server internal error (-32603): {detail}"),
            McpError::Server { code, message } => write!(f, "server error ({code}): {message}"),
            McpError::Timeout => write!(f, "request timed out"),
            McpError::Closed => write!(f, "connection closed by peer"),
        }
    }
}

impl std::error::Error for McpError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            McpError::Io(error) => Some(error),
            _ => None,
        }
    }
}

impl From<std::io::Error> for McpError {
    fn from(error: std::io::Error) -> Self {
        McpError::Io(error)
    }
}

/// Converts a JSON-RPC `error` object (`{code, message, [data]}`) into the
/// matching typed variant, defaulting to [`McpError::Internal`] when fields
/// are missing or malformed.
pub fn map_jsonrpc_error(error: &serde_json::Value) -> McpError {
    let code = error
        .get("code")
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(ERR_INTERNAL);
    let message = error
        .get("message")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("unknown server error");
    McpError::from_rpc_code(code, message)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reserved_codes_map_to_dedicated_variants() {
        assert!(matches!(
            McpError::from_rpc_code(-32700, "bad json"),
            McpError::Parse(_)
        ));
        assert!(matches!(
            McpError::from_rpc_code(-32600, "bad request"),
            McpError::InvalidRequest(_)
        ));
        assert!(matches!(
            McpError::from_rpc_code(-32601, "nope"),
            McpError::MethodNotFound(_)
        ));
        assert!(matches!(
            McpError::from_rpc_code(-32602, "bad args"),
            McpError::InvalidParams(_)
        ));
        assert!(matches!(
            McpError::from_rpc_code(-32603, "boom"),
            McpError::Internal(_)
        ));
    }

    #[test]
    fn custom_codes_become_server_errors_with_code_preserved() {
        let error = McpError::from_rpc_code(-32099, "rate limited");
        match &error {
            McpError::Server { code, message } => {
                assert_eq!(*code, -32099);
                assert_eq!(message, "rate limited");
            }
            other => panic!("unexpected variant {other:?}"),
        }
        assert_eq!(error.rpc_code(), Some(-32099));
    }

    #[test]
    fn transport_failures_carry_no_rpc_code() {
        assert_eq!(McpError::Timeout.rpc_code(), None);
        assert_eq!(McpError::Closed.rpc_code(), None);
        let display = format!("{}", McpError::MethodNotFound("tools/x".to_string()));
        assert!(display.contains("-32601"));
        assert!(display.contains("tools/x"));
    }

    #[test]
    fn io_errors_convert_and_source_correctly() {
        let io_error = std::io::Error::new(std::io::ErrorKind::BrokenPipe, "pipe broke");
        let error = McpError::from(io_error);
        assert!(matches!(error, McpError::Io(_)));
        assert!(std::error::Error::source(&error).is_some());
    }
}
