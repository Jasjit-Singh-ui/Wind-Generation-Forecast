import { useId, useState, type ReactNode } from "react";
import { downloadCsv, toCsv } from "../lib/csv";
import { DataTable, type Column } from "./DataTable";
import { Legend, type LegendItem } from "./Legend";

interface ChartCardProps<Row> {
  title: ReactNode;
  subtitle?: ReactNode;
  legend?: LegendItem[];
  /** The chart's table-view twin and CSV export (omit when the twin is shown next to the chart). */
  table?: { columns: Column<Row>[]; rows: Row[]; filename: string };
  footnote?: ReactNode;
  /** Extra controls shown before the Table/CSV buttons. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function ChartCard<Row>({
  title,
  subtitle,
  legend,
  table,
  footnote,
  actions,
  className,
  children,
}: ChartCardProps<Row>) {
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();
  return (
    <section className={`card ${className ?? ""}`} aria-labelledby={titleId}>
      <div className="card-head">
        <div className="card-titles">
          <h2 className="card-title" id={titleId}>
            {title}
          </h2>
          {subtitle && <p className="card-sub">{subtitle}</p>}
        </div>
        <div className="card-actions">
          {actions}
          {table && (
            <>
              <button type="button" className="btn" aria-pressed={showTable} onClick={() => setShowTable((v) => !v)}>
                {showTable ? "Chart" : "Table"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => downloadCsv(table.filename, toCsv(table.columns, table.rows))}
                title="Download the numbers behind this chart"
              >
                CSV
              </button>
            </>
          )}
        </div>
      </div>
      {legend && !showTable && <Legend items={legend} />}
      {showTable && table ? (
        <DataTable columns={table.columns} rows={table.rows} caption={typeof title === "string" ? title : "Chart data"} />
      ) : (
        children
      )}
      {footnote && <p className="card-foot">{footnote}</p>}
    </section>
  );
}
