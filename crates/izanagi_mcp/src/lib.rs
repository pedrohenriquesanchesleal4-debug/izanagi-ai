//! # izanagi_mcp — MCP client over newline-delimited stdio
//!
//! JSON-RPC 2.0 client for the Model Context Protocol (protocolVersion
//! `2025-06-18`): newline frame codec, typed error taxonomy covering the
//! reserved codes (`-32700/-32600/-32601/-32602/-32603`) and a transport-
//! generic [`McpClient`] with configurable per-request timeout.
//!
//! ```
//! use izanagi_mcp::{ClientInfo, McpClient};
//!
//! // Any Read+Send / Write pair works — here, OS pipes as stand-ins for a
//! // spawned server's stdout/stdin halves.
//! let (client_reader, _server_writer) = std::io::pipe().unwrap();
//! let (_server_reader, client_writer) = std::io::pipe().unwrap();
//! let mut client = McpClient::new(client_reader, client_writer);
//! let info = ClientInfo::new("demo-client", "0.1.0");
//! let _handshake = move || client.initialize(info);
//! ```

pub mod client;
pub mod codec;
pub mod error;

pub use client::{ClientInfo, McpClient, Tool, PROTOCOL_VERSION};
pub use codec::{decode_frame, encode_frame, FrameError};
pub use error::{
    map_jsonrpc_error, McpError, ERR_INTERNAL, ERR_INVALID_PARAMS, ERR_INVALID_REQUEST,
    ERR_METHOD_NOT_FOUND, ERR_PARSE,
};

/// Version of this crate as advertised by the `izanagi-mcp` binary.
pub const CRATE_VERSION: &str = env!("CARGO_PKG_VERSION");
