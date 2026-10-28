export interface CsvColumn<Row> {
  label: string;
  value: (row: Row) => string | number | null | undefined;
}

function cell(value: string | number | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  // Neutralise spreadsheet formulas in free text, then quote if needed.
  const text = /^[=+\-@]/.test(value) && Number.isNaN(Number(value)) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<Row>(columns: CsvColumn<Row>[], rows: Row[]): string {
  const header = columns.map((c) => cell(c.label)).join(",");
  const body = rows.map((row) => columns.map((c) => cell(c.value(row))).join(","));
  return [header, ...body].join("\r\n") + "\r\n";
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
