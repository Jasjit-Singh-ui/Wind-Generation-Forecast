import type { ReactNode } from "react";

export interface Column<Row> {
  label: string;
  /** Raw value, used for CSV export (and display when `format` is absent). */
  value: (row: Row) => string | number | null | undefined;
  format?: (row: Row) => ReactNode;
  numeric?: boolean;
  /** Series colour shown as a key in the header. */
  color?: string;
}

export function DataTable<Row>({ columns, rows, caption }: { columns: Column<Row>[]; rows: Row[]; caption: string }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.label} scope="col" className={column.numeric ? "num" : undefined}>
                {column.color && <span className="cell-key" style={{ background: column.color }} aria-hidden="true" />}
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column.label} className={column.numeric ? "num" : undefined}>
                  {column.format ? column.format(row) : (column.value(row) ?? "–")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
