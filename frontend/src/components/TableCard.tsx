import { useId, type ReactNode } from "react";
import { downloadCsv, toCsv } from "../lib/csv";
import { DataTable, type Column } from "./DataTable";

interface TableCardProps<Row> {
  title: string;
  subtitle?: ReactNode;
  columns: Column<Row>[];
  rows: Row[];
  filename: string;
  footnote?: ReactNode;
}

export function TableCard<Row>({ title, subtitle, columns, rows, filename, footnote }: TableCardProps<Row>) {
  const titleId = useId();
  return (
    <section className="card" aria-labelledby={titleId}>
      <div className="card-head">
        <div className="card-titles">
          <h2 className="card-title" id={titleId}>
            {title}
          </h2>
          {subtitle && <p className="card-sub">{subtitle}</p>}
        </div>
        <div className="card-actions">
          <button type="button" className="btn" onClick={() => downloadCsv(filename, toCsv(columns, rows))}>
            Download CSV
          </button>
        </div>
      </div>
      <DataTable columns={columns} rows={rows} caption={title} />
      {footnote && <p className="card-foot">{footnote}</p>}
    </section>
  );
}
