import type { SqlValue } from "../../../../shared/types/api";
import { cx } from "../../../utils/cx";
import "./DataGrid.scss";

interface DataGridProps {
  columns: readonly string[];
  rows: readonly Record<string, SqlValue>[];
  emptyText: string;
  rowOffset?: number;
}

function renderCell(value: SqlValue | undefined): string {
  if (value === null || value === undefined) return "NULL";
  return String(value);
}

export function DataGrid({ columns, rows, emptyText, rowOffset = 0 }: DataGridProps) {
  return (
    <div className="data-grid">
      <table className="data-grid__table">
        <thead>
          <tr>
            <th className="data-grid__index">#</th>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="data-grid__empty">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="data-grid__index">{rowOffset + rowIndex + 1}</td>
                {columns.map((column) => {
                  const value = row[column];
                  const isNull = value === null || value === undefined;
                  return (
                    <td
                      key={column}
                      className={cx(isNull && "data-grid__null", typeof value === "number" && "data-grid__num")}
                      title={isNull ? undefined : String(value)}
                    >
                      {renderCell(value)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
