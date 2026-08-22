/**
 * Console output helpers: clean, deterministic, emoji-free.
 */

export function out(text: string): void {
  process.stdout.write(`${text}\n`);
}

export function warn(text: string): void {
  process.stderr.write(`warn: ${text}\n`);
}

/** Renders a simple aligned text table from row objects. */
export function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = headers.map((header, columnIndex) =>
    Math.max(header.length, ...rows.map((row) => row[columnIndex]?.length ?? 0)),
  );
  const line = (cells: readonly string[]): string =>
    cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  ");
  const headerLine = line(headers);
  const separator = widths.map((width) => "-".repeat(width)).join("  ");
  return [headerLine, separator, ...rows.map(line)].join("\n");
}

export function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}
