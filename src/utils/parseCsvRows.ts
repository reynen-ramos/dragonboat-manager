/** One parsed row, with the 1-based line of the file it came from. */
export interface CsvRow {
  cells: string[];
  line: number;
}

/**
 * Minimal RFC 4180 parser: handles quoted fields, escaped quotes, and CRLF.
 *
 * Line numbers are carried through rather than inferred from array position.
 * Blank lines are dropped, so an index into the result stopped matching the
 * spreadsheet row as soon as a file had one — and a row number pointing at the
 * wrong line is worse than none, since its whole job is to send someone back
 * to the row that needs fixing.
 */
export function parseCsvRows(text: string): CsvRow[] {
  // A leading BOM would otherwise become part of the first header cell.
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let value = '';
  let inQuotes = false;
  let line = 1;
  let rowStartedAt = 1;

  const endRow = () => {
    cells.push(value);
    rows.push({ cells, line: rowStartedAt });
    cells = [];
    value = '';
  };

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        // A newline inside quotes is content, but it still advances the file.
        if (char === '\n') line++;
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(value);
      value = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      endRow();
      line++;
      rowStartedAt = line;
    } else {
      value += char;
    }
  }

  if (value !== '' || cells.length > 0) endRow();

  return rows.filter((row) => row.cells.some((cell) => cell.trim() !== ''));
}

/** Cells only, for callers that do not report positions back to the user. */
export function parseCsv(text: string): string[][] {
  return parseCsvRows(text).map((row) => row.cells);
}
