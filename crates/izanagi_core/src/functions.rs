//! Structural extraction of function extents from masked skeletons.
//!
//! Extraction works exclusively on masked text (comments/strings already
//! blanked), so braces and keywords inside literals can never confuse the
//! scanners. For brace languages, nested functions are absorbed into their
//! parent extent (preventing double-counted findings); for Python, ownership
//! of nested `def` blocks is resolved by the rules layer.

use crate::lang::Language;
use crate::mask::{LineIndex, Scan};

/// How a function body is delimited.
#[derive(Debug, Clone)]
pub enum ExtentKind {
    /// Brace-delimited body; indices refer to the joined masked text.
    Braced {
        open_index: usize,
        close_index: usize,
    },
    /// Python indentation-delimited body.
    Indented,
}

/// One detected function/method/closure. Lines are 1-based and inclusive.
#[derive(Debug, Clone)]
pub struct FunctionExtent {
    pub name: String,
    pub header_line: usize,
    pub end_line: usize,
    pub kind: ExtentKind,
}

/// Extracts every top-level (non-absorbed) function extent from a scan.
pub fn extract_functions(language: Language, scan: &Scan) -> Vec<FunctionExtent> {
    let masked_text = scan.masked_lines.join("\n");
    match language {
        Language::TypeScript | Language::Go => extract_braced(language, &masked_text),
        Language::Python => extract_python(&scan.masked_lines),
    }
}

struct Header {
    name: String,
    start_index: usize,
    brace_index: usize,
}

fn extract_braced(language: Language, text: &str) -> Vec<FunctionExtent> {
    let index = LineIndex::new(text);
    let mut headers = match language {
        Language::Go => go_headers(text),
        _ => ts_headers(text),
    };
    headers.sort_by_key(|h| h.brace_index);

    let mut extents = Vec::new();
    let mut last_close: usize = 0;
    for header in headers {
        let Some(close_index) = matching_brace(text.as_bytes(), header.brace_index) else {
            continue;
        };
        if header.brace_index < last_close {
            continue;
        }
        last_close = close_index + 1;
        extents.push(FunctionExtent {
            name: header.name.clone(),
            header_line: index.line_of(header.start_index),
            end_line: index.line_of(close_index),
            kind: ExtentKind::Braced {
                open_index: header.brace_index,
                close_index,
            },
        });
    }
    extents
}

fn go_headers(text: &str) -> Vec<Header> {
    let b = text.as_bytes();
    let mut headers = Vec::new();
    let mut from = 0usize;
    while let Some(pos) = find_word(b, b"func", from) {
        from = pos + 4;
        let mut j = skip_ws(b, pos + 4);
        let mut group_consumed = false;

        if b.get(j) == Some(&b'(') {
            match matching_paren(b, j) {
                Some(after_group) => {
                    group_consumed = true;
                    j = skip_ws(b, after_group);
                }
                None => continue,
            }
        }

        let mut name = "<anon>".to_string();
        let mut named = false;
        let name_len = word_len(b, j);
        if name_len > 0 {
            let candidate = String::from_utf8_lossy(&b[j..j + name_len]).into_owned();
            let after_name = skip_ws(b, j + name_len);
            if b.get(after_name) == Some(&b'(') {
                match matching_paren(b, after_name) {
                    Some(after_params) => {
                        name = candidate;
                        named = true;
                        j = after_params;
                    }
                    None => continue,
                }
            } else if !group_consumed {
                // `func Identifier` without parameters is never a header here.
                continue;
            }
        } else if !group_consumed {
            continue;
        }

        // Named functions may declare multi-line result lists; anonymous
        // closures must open their body nearby so `func(...)` used as a type
        // does not steal some later construct's brace.
        let body_search_from = if named { j } else { j.min(skip_ws(b, j)) };
        let body_open = if named {
            find_byte(b, b'{', body_search_from)
        } else {
            reachable_brace(b, body_search_from)
        };
        let Some(body_open) = body_open else {
            continue;
        };
        headers.push(Header {
            name,
            start_index: pos,
            brace_index: body_open,
        });
    }
    headers
}

const TS_RESERVED: [&[u8]; 30] = [
    b"if",
    b"else",
    b"for",
    b"while",
    b"do",
    b"switch",
    b"case",
    b"default",
    b"try",
    b"catch",
    b"finally",
    b"return",
    b"function",
    b"class",
    b"new",
    b"typeof",
    b"void",
    b"delete",
    b"instanceof",
    b"in",
    b"of",
    b"async",
    b"await",
    b"yield",
    b"const",
    b"let",
    b"var",
    b"static",
    b"readonly",
    b"declare",
];

fn ts_headers(text: &str) -> Vec<Header> {
    let b = text.as_bytes();
    let mut headers = Vec::new();

    let mut from = 0usize;
    while let Some(pos) = find_word(b, b"function", from) {
        from = pos + 8;
        let mut j = skip_ws(b, pos + 8);
        if b.get(j) == Some(&b'*') {
            j = skip_ws(b, j + 1);
        }
        let name_end = j + word_len(b, j);
        let name = if name_end > j {
            let parsed = String::from_utf8_lossy(&b[j..name_end]).into_owned();
            j = skip_ws(b, name_end);
            parsed
        } else {
            "<anon>".to_string()
        };
        if b.get(j) != Some(&b'(') {
            continue;
        }
        let Some(after_params) = matching_paren(b, j) else {
            continue;
        };
        let Some(body_open) = reachable_brace(b, after_params) else {
            continue;
        };
        headers.push(Header {
            name,
            start_index: pos,
            brace_index: body_open,
        });
    }

    headers.extend(ts_arrow_headers(b));
    headers.extend(ts_method_headers(b));
    headers
}

fn ts_method_headers(b: &[u8]) -> Vec<Header> {
    let mut headers = Vec::new();
    let mut p = 0usize;
    while p < b.len() {
        if !is_ident_start(b[p]) || (p > 0 && is_ident_byte(b[p - 1])) {
            p += 1;
            continue;
        }
        let len = word_len(b, p);
        let word = &b[p..p + len];
        if TS_RESERVED.contains(&word) {
            p += len.max(1);
            continue;
        }
        let j = skip_ws(b, p + len);
        if b.get(j) != Some(&b'(') {
            p += len.max(1);
            continue;
        }
        let Some(after_params) = matching_paren(b, j) else {
            p += len.max(1);
            continue;
        };
        if let Some(body_open) = reachable_brace(b, after_params) {
            headers.push(Header {
                name: String::from_utf8_lossy(word).into_owned(),
                start_index: p,
                brace_index: body_open,
            });
        }
        p += len.max(1);
    }
    headers
}

fn ts_arrow_headers(b: &[u8]) -> Vec<Header> {
    const BINDINGS: [&[u8]; 3] = [b"const", b"let", b"var"];
    let mut headers = Vec::new();
    let mut from = 0usize;
    while let Some(binding_pos) = BINDINGS
        .iter()
        .filter_map(|kw| find_word(b, kw, from))
        .min()
    {
        let binding_len = b[binding_pos..]
            .iter()
            .position(|c| !is_ident_byte(*c))
            .unwrap_or(b.len() - binding_pos);
        from = binding_pos + binding_len;
        let mut j = skip_ws(b, binding_pos + binding_len);

        let name_end = j + word_len(b, j);
        if name_end == j {
            continue;
        }
        let name = String::from_utf8_lossy(&b[j..name_end]).into_owned();
        j = skip_ws(b, name_end);
        if b.get(j) != Some(&b'=') || b.get(j + 1) == Some(&b'=') {
            continue;
        }
        j = skip_ws(b, j + 1);
        if find_word_at(b, b"async", j) {
            j = skip_ws(b, j + 5);
        }

        let after_params = if b.get(j) == Some(&b'(') {
            match matching_paren(b, j) {
                Some(end) => end,
                None => continue,
            }
        } else {
            let single = j + word_len(b, j);
            if single == j {
                continue;
            }
            single
        };
        j = skip_ws(b, after_params);
        if b.get(j) == Some(&b':') {
            match find_arrow_fat(b, j) {
                Some(fat) => j = fat,
                None => continue,
            }
        } else if b[j..].starts_with(b"=>") {
            j += 2;
        } else {
            continue;
        }
        let body_open = skip_ws(b, j);
        if b.get(body_open) != Some(&b'{') {
            continue;
        }
        headers.push(Header {
            name,
            start_index: binding_pos,
            brace_index: body_open,
        });
    }
    headers
}

fn extract_python(lines: &[String]) -> Vec<FunctionExtent> {
    let mut extents = Vec::new();
    for (i, line) in lines.iter().enumerate() {
        let Some((name, indent)) = python_def_header(line) else {
            continue;
        };
        let mut end = i;
        for (j, candidate) in lines.iter().enumerate().skip(i + 1) {
            if candidate.trim().is_empty() {
                continue;
            }
            if indent_width(candidate) > indent {
                end = j;
            } else {
                break;
            }
        }
        extents.push(FunctionExtent {
            name,
            header_line: i + 1,
            end_line: end + 1,
            kind: ExtentKind::Indented,
        });
    }
    extents
}

/// Returns `(name, indent_width)` for a `def`/`async def` header line.
fn python_def_header(line: &str) -> Option<(String, usize)> {
    let indent = indent_width(line);
    let mut rest = line.trim_start();
    if let Some(stripped) = rest.strip_prefix("async") {
        if !stripped.starts_with(char::is_whitespace) {
            return None;
        }
        rest = stripped.trim_start();
    }
    let after_def = rest.strip_prefix("def ")?;
    let name_end = after_def
        .find(|c: char| !(c.is_alphanumeric() || c == '_'))
        .unwrap_or(after_def.len());
    let name = &after_def[..name_end];
    if name.is_empty() || name.chars().next().is_some_and(|c| c.is_ascii_digit()) {
        return None;
    }
    if !after_def[name_end..].trim_start().starts_with('(') {
        return None;
    }
    Some((name.to_string(), indent))
}

/// Tabs expand to 4 columns; other characters count as themselves.
pub fn indent_width(line: &str) -> usize {
    line.chars()
        .take_while(|c| c.is_whitespace())
        .map(|c| if c == '\t' { 4 } else { 1 })
        .sum()
}

pub(crate) fn matching_brace(b: &[u8], open: usize) -> Option<usize> {
    let mut depth = 0usize;
    for (k, &byte) in b.iter().enumerate().skip(open) {
        match byte {
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(k);
                }
            }
            _ => {}
        }
    }
    None
}

pub(crate) fn matching_paren(b: &[u8], open: usize) -> Option<usize> {
    let mut depth = 0usize;
    for (k, &byte) in b.iter().enumerate().skip(open) {
        match byte {
            b'(' => depth += 1,
            b')' => {
                depth -= 1;
                if depth == 0 {
                    return Some(k + 1);
                }
            }
            _ => {}
        }
    }
    None
}

/// First `{` after `from`, unless `;`/`}` intervenes first or the brace only
/// appears past a newline that is not immediately followed by `{` — this keeps
/// statement-level braces from being claimed by phantom headers.
fn reachable_brace(b: &[u8], from: usize) -> Option<usize> {
    let mut k = from;
    while k < b.len() {
        match b[k] {
            b'{' => return Some(k),
            b';' | b'}' => return None,
            b'\n' => {
                let next = skip_ws(b, k + 1);
                return if b.get(next) == Some(&b'{') && next.saturating_sub(from) <= 96 {
                    Some(next)
                } else {
                    None
                };
            }
            _ => {}
        }
        k += 1;
    }
    None
}

fn find_arrow_fat(b: &[u8], from: usize) -> Option<usize> {
    let mut j = from;
    while j + 1 < b.len() {
        if b[j] == b';' || b[j] == b'\n' {
            return None;
        }
        if b[j] == b'=' && b[j + 1] == b'>' {
            return Some(j + 2);
        }
        j += 1;
    }
    None
}

fn find_byte(b: &[u8], needle: u8, from: usize) -> Option<usize> {
    b[from.min(b.len())..]
        .iter()
        .position(|&byte| byte == needle)
        .map(|offset| from.min(b.len()) + offset)
}

pub(crate) fn find_word(b: &[u8], word: &[u8], from: usize) -> Option<usize> {
    if word.is_empty() || word.len() > b.len() {
        return None;
    }
    let mut start = from.min(b.len());
    while start <= b.len().saturating_sub(word.len()) {
        let window = &b[start..start + word.len()];
        if window == word
            && (start == 0 || !is_ident_byte(b[start - 1]))
            && (start + word.len() == b.len() || !is_ident_byte(b[start + word.len()]))
        {
            return Some(start);
        }
        start += 1;
    }
    None
}

fn find_word_at(b: &[u8], word: &[u8], at: usize) -> bool {
    b[at.min(b.len())..].starts_with(word)
        && (at + word.len() == b.len() || !is_ident_byte(b[at + word.len()]))
}

fn word_len(b: &[u8], at: usize) -> usize {
    b[at..]
        .iter()
        .take_while(|&&byte| is_ident_byte(byte))
        .count()
}

fn is_ident_start(byte: u8) -> bool {
    byte.is_ascii_alphabetic() || byte == b'_' || byte == b'$' || byte >= 0x80
}

fn is_ident_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$' || byte >= 0x80
}

pub(crate) fn skip_ws(b: &[u8], mut j: usize) -> usize {
    while j < b.len() && (b[j] as char).is_whitespace() {
        j += 1;
    }
    j
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mask::scan;

    fn names(language: Language, source: &str) -> Vec<String> {
        let masked = scan(language, source);
        extract_functions(language, &masked)
            .into_iter()
            .map(|extent| extent.name)
            .collect()
    }

    #[test]
    fn finds_go_functions_and_methods() {
        let source = "package main\n\nfunc Run(cfg Config) error {\n\treturn nil\n}\n\nfunc (s *Server) Start(ctx context.Context) error {\n\treturn s.listen()\n}\n";
        assert_eq!(names(Language::Go, source), vec!["Run", "Start"]);
    }

    #[test]
    fn finds_ts_declarations_arrows_and_methods() {
        let source = "function alpha() {}\nconst beta = async (x: number): Promise<void> => {\n  await x;\n};\nclass Svc {\n  gamma(input: string): boolean {\n    return true;\n  }\n}\n";
        assert_eq!(
            names(Language::TypeScript, source),
            vec!["alpha", "beta", "gamma"]
        );
    }

    #[test]
    fn absorbs_nested_closures_into_parent() {
        let source =
            "function outer() {\n  const inner = () => { return 1; };\n  return inner;\n}\n";
        assert_eq!(names(Language::TypeScript, source), vec!["outer"]);
    }

    #[test]
    fn finds_nested_python_defs_independently() {
        let source = "def outer():\n    def inner():\n        return 1\n    return inner\n";
        assert_eq!(names(Language::Python, source), vec!["outer", "inner"]);
    }

    #[test]
    fn python_extents_cover_full_indented_block() {
        let masked = scan(
            Language::Python,
            "def f():\n    a = 1\n    b = 2\nrest = 3\n",
        );
        let extents = extract_functions(Language::Python, &masked);
        let extent = extents.first().expect("one function");
        assert_eq!(extent.header_line, 1);
        assert_eq!(extent.end_line, 3);
    }

    #[test]
    fn async_go_style_receivers_do_not_confuse_names() {
        let source = "func (c *Client) Do(ctx context.Context, fn func(int) error) error {\n    return fn(1)\n}\n";
        assert_eq!(names(Language::Go, source), vec!["Do"]);
    }
}
