//! Newline-delimited JSON framing over any `BufRead`/`Write`.

use std::io::{BufRead, Write};

use serde_json::Value;

#[derive(Debug)]
pub enum FrameError {
    Io(std::io::Error),
    Malformed(String),
}

impl From<std::io::Error> for FrameError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

/// Serializes `value` as one compact JSON line and flushes.
pub fn encode_frame<W: Write>(writer: &mut W, value: &Value) -> std::io::Result<()> {
    let mut line = serde_json::to_string(value)
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error))?;
    line.push('\n');
    writer.write_all(line.as_bytes())?;
    writer.flush()
}

/// Reads the next non-blank frame; `Ok(None)` signals clean EOF at a frame
/// boundary. Blank lines between frames are tolerated and skipped.
pub fn decode_frame<R: BufRead>(
    reader: &mut R,
    buffer: &mut String,
) -> Result<Option<Value>, FrameError> {
    loop {
        buffer.clear();
        let read = reader.read_line(buffer)?;
        if read == 0 {
            return Ok(None);
        }
        let trimmed = buffer.trim();
        if trimmed.is_empty() {
            continue;
        }
        return serde_json::from_str(trimmed)
            .map(Some)
            .map_err(|error| FrameError::Malformed(error.to_string()));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::io::{BufWriter, Cursor};

    #[test]
    fn frames_round_trip_with_newlines_inside_strings() {
        let mut wire: Vec<u8> = Vec::new();
        {
            let mut writer = BufWriter::new(&mut wire);
            encode_frame(&mut writer, &json!({ "text": "line1\nline2" })).unwrap();
            writer.flush().unwrap();
        }

        let mut cursor = Cursor::new(wire);
        let mut buffer = String::new();
        let frame = decode_frame(&mut cursor, &mut buffer)
            .expect("decodes")
            .expect("has frame");
        assert_eq!(frame["text"], "line1\nline2");
        assert!(decode_frame(&mut cursor, &mut buffer).unwrap().is_none());
    }

    #[test]
    fn blank_lines_are_skipped_and_garbage_is_reported() {
        let wire = b"\n\n{\"ok\":true}\nnot-json\n";
        let mut cursor = Cursor::new(&wire[..]);
        let mut buffer = String::new();
        let first = decode_frame(&mut cursor, &mut buffer).unwrap().unwrap();
        assert_eq!(first["ok"], true);
        match decode_frame(&mut cursor, &mut buffer) {
            Err(FrameError::Malformed(_)) => {}
            other => panic!("expected malformed frame, got {other:?}"),
        }
    }

    #[test]
    fn eof_without_trailing_newline_still_yields_last_frame() {
        let wire = br#"{"id":7}"#;
        let mut cursor = Cursor::new(&wire[..]);
        let mut buffer = String::new();
        let frame = decode_frame(&mut cursor, &mut buffer)
            .unwrap()
            .expect("frame");
        assert_eq!(frame["id"], 7);
        assert!(decode_frame(&mut cursor, &mut buffer).unwrap().is_none());
    }
}
