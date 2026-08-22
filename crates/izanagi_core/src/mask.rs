//! Lexical scanner that masks comments and string literals while preserving
//! line structure, so structural heuristics only ever see the code skeleton.
//!
//! Masking keeps every physical newline in place, which makes
//! [`Scan::masked_lines`] align 1:1 with `source.lines()`; every extracted
//! comment/string hit carries an exact 1-based line number. Known deliberate
//! simplifications: TypeScript template-literal interpolations are masked as a
//! whole, and regex literals are detected through a conservative look-behind
//! heuristic (division never gets masked).

use crate::lang::Language;

/// Distinguishes `//`-style comments from `/* */`-style ones.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommentKind {
    Line,
    Block,
}

/// A comment occurrence attributed to a physical line (1-based).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentHit {
    pub kind: CommentKind,
    pub line: usize,
    pub text: String,
}

/// A string-literal occurrence attributed to a physical line (1-based).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StringHit {
    pub line: usize,
    pub text: String,
}

/// Masked skeleton of a source plus every extracted comment/string literal.
#[derive(Debug, Clone)]
pub struct Scan {
    pub masked_lines: Vec<String>,
    pub comments: Vec<CommentHit>,
    pub strings: Vec<StringHit>,
}

/// Scans `source`, producing the masked skeleton plus comment/string hits.
pub fn scan(language: Language, source: &str) -> Scan {
    let chars: Vec<char> = source.chars().collect();
    let mut out: Vec<char> = chars.clone();
    let mut comments: Vec<CommentHit> = Vec::new();
    let mut strings: Vec<StringHit> = Vec::new();

    let n = chars.len();
    let mut i = 0usize;
    while i < n {
        let next = match language {
            Language::TypeScript => step_ts(&chars, &mut out, i, &mut comments, &mut strings),
            Language::Go => step_go(&chars, &mut out, i, &mut comments, &mut strings),
            Language::Python => step_python(&chars, &mut out, i, &mut comments, &mut strings),
        };
        i = if next > i { next } else { i + 1 };
    }

    let masked_lines: Vec<String> = out
        .into_iter()
        .collect::<String>()
        .lines()
        .map(str::to_string)
        .collect();

    Scan {
        masked_lines,
        comments,
        strings,
    }
}

fn at(chars: &[char], index: usize) -> Option<char> {
    chars.get(index).copied()
}

fn line_at(chars: &[char], index: usize) -> usize {
    chars[..index].iter().filter(|&&c| c == '\n').count() + 1
}

fn blank(out: &mut [char], start: usize, end: usize) {
    for slot in &mut out[start..end] {
        if *slot != '\n' {
            *slot = ' ';
        }
    }
}

/// Splits `[start, end)` into trimmed non-empty per-line pieces, attributing
/// each piece to its physical 1-based line number.
fn collect_lines(chars: &[char], start: usize, end: usize) -> Vec<(usize, String)> {
    let mut pieces = Vec::new();
    let mut segment_start = start;
    let mut line = line_at(chars, start);
    let mut idx = start;
    while idx < end {
        if chars[idx] == '\n' {
            let piece: String = chars[segment_start..idx].iter().collect();
            let trimmed = piece.trim();
            if !trimmed.is_empty() {
                pieces.push((line, trimmed.to_string()));
            }
            line += 1;
            segment_start = idx + 1;
        }
        idx += 1;
    }
    if segment_start < end {
        let piece: String = chars[segment_start..end].iter().collect();
        let trimmed = piece.trim();
        if !trimmed.is_empty() {
            pieces.push((line, trimmed.to_string()));
        }
    }
    pieces
}

fn until_newline(chars: &[char], mut j: usize) -> usize {
    while j < chars.len() && chars[j] != '\n' {
        j += 1;
    }
    j
}

/// Returns `(end_index_exclusive, terminated)`; unterminated runs to EOF.
fn block_comment_end(chars: &[char], mut j: usize) -> (usize, bool) {
    let n = chars.len();
    while j < n {
        if chars[j] == '*' && j + 1 < n && chars[j + 1] == '/' {
            return (j + 2, true);
        }
        j += 1;
    }
    (n, false)
}

/// Single/double-quoted string: escape-aware, dies at unescaped newline.
fn quoted_end(chars: &[char], open: usize) -> usize {
    let quote = chars[open];
    let n = chars.len();
    let mut j = open + 1;
    while j < n {
        match chars[j] {
            '\\' => j += 2,
            c if c == quote => return j + 1,
            '\n' => return j,
            _ => j += 1,
        }
    }
    n.min(j)
}

/// Template literal / rune-aware quoted scan that tolerates newlines.
fn template_end(chars: &[char], open: usize) -> usize {
    let n = chars.len();
    let mut j = open + 1;
    while j < n {
        match chars[j] {
            '\\' => j += 2,
            '`' => return j + 1,
            _ => j += 1,
        }
    }
    n.min(j)
}

/// Go raw string: no escape processing, newlines allowed.
fn raw_string_end(chars: &[char], open: usize) -> usize {
    let n = chars.len();
    let mut j = open + 1;
    while j < n {
        if chars[j] == '`' {
            return j + 1;
        }
        j += 1;
    }
    n
}

/// Python triple-quoted string: escape-aware, closes on three quotes.
fn triple_end(chars: &[char], open: usize) -> (usize, bool) {
    let quote = chars[open];
    let n = chars.len();
    let mut j = open + 3;
    while j < n {
        if chars[j] == '\\' {
            j += 2;
            continue;
        }
        if chars[j] == quote && at(chars, j + 1) == Some(quote) && at(chars, j + 2) == Some(quote)
        {
            return (j + 3, true);
        }
        j += 1;
    }
    (n.min(j), false)
}

/// Look-behind deciding whether a `/` can open a regex literal rather than be
/// division. Masked regions read as spaces, so prior literals/comments are
/// transparent to the heuristic.
fn regex_can_start(out: &[char], idx: usize) -> bool {
    let mut k = idx;
    while k > 0 {
        k -= 1;
        let c = out[k];
        if c.is_whitespace() {
            continue;
        }
        if !(c.is_alphanumeric() || c == '_' || c == '$') {
            return c != ')' && c != ']';
        }
        let mut s = k;
        while s > 0 && (out[s - 1].is_alphanumeric() || out[s - 1] == '_' || out[s - 1] == '$') {
            s -= 1;
        }
        let word: String = out[s..=k].iter().collect();
        return matches!(
            word.as_str(),
            "return" | "typeof" | "case" | "in" | "of" | "new" | "delete" | "void" | "do"
                | "else" | "yield" | "await" | "throw"
        );
    }
    true
}

/// Returns the exclusive end of a closed regex literal, or `None` when no
/// closing `/` exists before the end of the line (treat as division).
fn regex_scan(chars: &[char], open: usize) -> Option<usize> {
    let n = chars.len();
    let mut j = open + 1;
    let mut in_class = false;
    while j < n {
        match chars[j] {
            '\\' => j += 2,
            '[' => {
                in_class = true;
                j += 1;
            }
            ']' => {
                in_class = false;
                j += 1;
            }
            '/' if !in_class => return Some(j + 1),
            '\n' => return None,
            _ => j += 1,
        }
    }
    None
}

fn step_ts(
    chars: &[char],
    out: &mut [char],
    i: usize,
    comments: &mut Vec<CommentHit>,
    strings: &mut Vec<StringHit>,
) -> usize {
    match chars[i] {
        '/' if at(chars, i + 1) == Some('/') => {
            let end = until_newline(chars, i + 2);
            blank(out, i, end);
            for (line, text) in collect_lines(chars, i + 2, end) {
                comments.push(CommentHit { kind: CommentKind::Line, line, text });
            }
            end
        }
        '/' if at(chars, i + 1) == Some('*') => {
            let (end, terminated) = block_comment_end(chars, i + 2);
            let content_end = if terminated { end - 2 } else { end };
            blank(out, i, end);
            for (line, text) in collect_lines(chars, i + 2, content_end) {
                comments.push(CommentHit { kind: CommentKind::Block, line, text });
            }
            end
        }
        '/' if regex_can_start(out, i) => match regex_scan(chars, i) {
            Some(end) => {
                blank(out, i, end);
                for (line, text) in collect_lines(chars, i + 1, end - 1) {
                    strings.push(StringHit { line, text });
                }
                end
            }
            None => i + 1,
        },
        '"' | '\'' => {
            let end = quoted_end(chars, i);
            let content_end = if end > i && chars.get(end - 1) == Some(&chars[i]) {
                end - 1
            } else {
                end
            };
            blank(out, i, end);
            for (line, text) in collect_lines(chars, i + 1, content_end) {
                strings.push(StringHit { line, text });
            }
            end
        }
        '`' => {
            let end = template_end(chars, i);
            let content_end = if end > i && chars.get(end - 1) == Some(&'`') {
                end - 1
            } else {
                end
            };
            blank(out, i, end);
            for (line, text) in collect_lines(chars, i + 1, content_end) {
                strings.push(StringHit { line, text });
            }
            end
        }
        _ => i + 1,
    }
}

fn step_go(
    chars: &[char],
    out: &mut [char],
    i: usize,
    comments: &mut Vec<CommentHit>,
    strings: &mut Vec<StringHit>,
) -> usize {
    match chars[i] {
        '/' if at(chars, i + 1) == Some('/') => {
            let end = until_newline(chars, i + 2);
            blank(out, i, end);
            for (line, text) in collect_lines(chars, i + 2, end) {
                comments.push(CommentHit { kind: CommentKind::Line, line, text });
            }
            end
        }
        '/' if at(chars, i + 1) == Some('*') => {
            let (end, terminated) = block_comment_end(chars, i + 2);
            let content_end = if terminated { end - 2 } else { end };
            blank(out, i, end);
            for (line, text) in collect_lines(chars, i + 2, content_end) {
                comments.push(CommentHit { kind: CommentKind::Block, line, text });
            }
            end
        }
        '"' | '\'' => {
            let end = quoted_end(chars, i);
            let content_end = if end > i && chars.get(end - 1) == Some(&chars[i]) {
                end - 1
            } else {
                end
            };
            blank(out, i, end);
            for (line, text) in collect_lines(chars, i + 1, content_end) {
                strings.push(StringHit { line, text });
            }
            end
        }
        '`' => {
            let end = raw_string_end(chars, i);
            let content_end = if end < chars.len() { end - 1 } else { end };
            blank(out, i, end);
            for (line, text) in collect_lines(chars, i + 1, content_end) {
                strings.push(StringHit { line, text });
            }
            end
        }
        _ => i + 1,
    }
}

fn step_python(
    chars: &[char],
    out: &mut [char],
    i: usize,
    comments: &mut Vec<CommentHit>,
    strings: &mut Vec<StringHit>,
) -> usize {
    match chars[i] {
        '#' => {
            let end = until_newline(chars, i + 1);
            blank(out, i, end);
            for (line, text) in collect_lines(chars, i + 1, end) {
                comments.push(CommentHit { kind: CommentKind::Line, line, text });
            }
            end
        }
        q @ ('\'' | '"') => {
            if at(chars, i + 1) == Some(q) && at(chars, i + 2) == Some(q) {
                let (end, terminated) = triple_end(chars, i);
                let content_end = if terminated { end - 3 } else { end };
                blank(out, i, end);
                for (line, text) in collect_lines(chars, i + 3, content_end) {
                    strings.push(StringHit { line, text });
                }
                end
            } else {
                let end = quoted_end(chars, i);
                let content_end = if end > i && chars.get(end - 1) == Some(&q) {
                    end - 1
                } else {
                    end
                };
                blank(out, i, end);
                for (line, text) in collect_lines(chars, i + 1, content_end) {
                    strings.push(StringHit { line, text });
                }
                end
            }
        }
        _ => i + 1,
    }
}

/// Precomputed line-start table for O(log n) byte-index → 1-based-line lookup.
#[derive(Debug, Clone)]
pub struct LineIndex {
    starts: Vec<usize>,
}

impl LineIndex {
    pub fn new(text: &str) -> Self {
        let starts = std::iter::once(0usize)
            .chain(text.match_indices('\n').map(|(pos, _)| pos + 1))
            .collect();
        LineIndex { starts }
    }

    pub fn line_of(&self, index: usize) -> usize {
        self.starts.partition_point(|&start| start <= index).max(1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn masked(language: Language, source: &str) -> Vec<String> {
        scan(language, source).masked_lines
    }

    #[test]
    fn masks_comments_and_strings_but_keeps_code() {
        let lines = masked(
            Language::TypeScript,
            "const a = \"x{ y }\"; // note {\nconst b = 1;\n",
        );
        assert_eq!(lines.len(), 2);
        assert!(lines[0].contains("const a ="));
        assert!(!lines[0].contains("x{ y }"));
        assert!(lines[0].trim_end().ends_with(';'));
        assert_eq!(lines[1], "const b = 1;");
    }

    #[test]
    fn ts_template_literal_braces_are_masked() {
        let lines = masked(Language::TypeScript, "const s = `${a ? b : c} {`;\n}");
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[1], "}");
        assert!(!lines[0].contains('?'));
    }

    #[test]
    fn ts_regex_literal_is_masked_but_division_is_not() {
        let scan = scan(
            Language::TypeScript,
            "const re = /a\\/b[/{]/g;\nconst d = a / b;\n",
        );
        assert!(scan.masked_lines[0].contains("const re ="));
        assert!(!scan.masked_lines[0].contains('['));
        assert!(scan.strings.iter().any(|hit| hit.text.contains("[/{]")));
        assert!(scan.masked_lines[1].contains("a / b"));
    }

    #[test]
    fn ts_regex_after_return_is_detected_via_keyword_lookbehind() {
        let scan = scan(Language::TypeScript, "function f() {\n  return /error/;\n}\n");
        assert!(!scan.masked_lines[1].contains("/error/"));
    }

    #[test]
    fn python_triple_docstring_spans_lines_with_correct_attribution() {
        let source = "def f():\n    \"\"\"first\n    second TODO\n    \"\"\"\n    return 1\n";
        let scan = scan(Language::Python, source);
        assert_eq!(scan.masked_lines.len(), 5);
        assert_eq!(scan.masked_lines[4], "    return 1");
        let todo_line = scan
            .strings
            .iter()
            .find(|hit| hit.text.contains("TODO"))
            .map(|hit| hit.line);
        assert_eq!(todo_line, Some(3));
    }

    #[test]
    fn go_raw_string_keeps_braces_invisible() {
        let scan = scan(Language::Go, "s := `{ if }`\nx := 1\n");
        assert!(!scan.masked_lines[0].contains('{'));
        assert_eq!(scan.masked_lines[1], "x := 1");
    }

    #[test]
    fn go_rune_literal_with_quote_is_handled() {
        let scan = scan(Language::Go, "q := '\\''\n");
        assert_eq!(scan.masked_lines[0].trim(), "q :=");
        assert!(scan.strings.iter().any(|hit| hit.text == "\\'"));
    }

    #[test]
    fn escaped_quotes_do_not_break_masking() {
        let scan = scan(Language::TypeScript, "const s = \"a\\\"b{\";\n");
        assert!(!scan.masked_lines[0].contains('{'));
    }

    #[test]
    fn block_comment_spanning_lines_reports_each_physical_line() {
        let source = "/* alpha\nbeta TODO\ngamma */\ncode();\n";
        let scan = scan(Language::Go, source);
        assert_eq!(scan.masked_lines.len(), 4);
        let todo = scan
            .comments
            .iter()
            .find(|hit| hit.text.contains("TODO"))
            .map(|hit| hit.line);
        assert_eq!(todo, Some(2));
    }

    #[test]
    fn line_index_maps_bytes_to_one_based_lines() {
        let index = LineIndex::new("ab\ncd\n");
        assert_eq!(index.line_of(0), 1);
        assert_eq!(index.line_of(3), 2);
        assert_eq!(index.line_of(4), 2);
        assert_eq!(index.line_of(5), 2);
    }
}
