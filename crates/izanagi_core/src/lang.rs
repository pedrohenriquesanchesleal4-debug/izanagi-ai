//! Target languages understood by the Quality Engine.

use std::fmt;
use std::str::FromStr;

use serde::de::Deserializer;
use serde::ser::Serializer;
use serde::{Deserialize, Serialize};

/// Languages the static analysis engine knows how to inspect.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Language {
    TypeScript,
    Python,
    Go,
}

impl Language {
    /// Every language understood by the engine, in protocol order.
    pub const ALL: [Language; 3] = [Language::TypeScript, Language::Python, Language::Go];

    /// Canonical wire name used by the JSON protocol.
    pub const fn as_str(self) -> &'static str {
        match self {
            Language::TypeScript => "typescript",
            Language::Python => "python",
            Language::Go => "go",
        }
    }
}

impl fmt::Display for Language {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Error produced when a request names a language outside the protocol contract.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnknownLanguageError {
    pub raw: String,
}

impl fmt::Display for UnknownLanguageError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "unknown language {:?}: expected \"typescript\", \"python\" or \"go\"",
            self.raw
        )
    }
}

impl std::error::Error for UnknownLanguageError {}

impl FromStr for Language {
    type Err = UnknownLanguageError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "typescript" => Ok(Language::TypeScript),
            "python" => Ok(Language::Python),
            "go" => Ok(Language::Go),
            other => Err(UnknownLanguageError {
                raw: other.to_string(),
            }),
        }
    }
}

impl Serialize for Language {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for Language {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let raw = String::deserialize(deserializer)?;
        Language::from_str(&raw).map_err(serde::de::Error::custom)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_every_protocol_language() {
        assert_eq!("typescript".parse::<Language>(), Ok(Language::TypeScript));
        assert_eq!("python".parse::<Language>(), Ok(Language::Python));
        assert_eq!("go".parse::<Language>(), Ok(Language::Go));
        assert_eq!(Language::ALL.len(), 3);
    }

    #[test]
    fn rejects_unknown_and_wrong_cased_names() {
        let err = "rust".parse::<Language>().unwrap_err();
        assert_eq!(err.raw, "rust");
        assert!("TypeScript".parse::<Language>().is_err());
        assert!("py".parse::<Language>().is_err());
    }

    #[test]
    fn display_matches_wire_name() {
        assert_eq!(Language::TypeScript.to_string(), "typescript");
        assert_eq!(Language::Python.to_string(), "python");
        assert_eq!(Language::Go.to_string(), "go");
    }

    #[test]
    fn serde_roundtrip_is_exact_wire_name() {
        let json = serde_json::to_string(&Language::TypeScript).unwrap();
        assert_eq!(json, "\"typescript\"");
        let parsed: Language = serde_json::from_str("\"go\"").unwrap();
        assert_eq!(parsed, Language::Go);
        assert!(serde_json::from_str::<Language>("\"kotlin\"").is_err());
    }
}
