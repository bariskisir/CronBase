import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, Database, Play, RefreshCw, Table2 } from "lucide-react";
import type { SqliteQueryResult, SqliteTableInfo, SqliteTableRows } from "../../../shared/types/api";
import { api, errorMessage } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { cx } from "../../utils/cx";
import {
  Badge,
  Button,
  DataGrid,
  EmptyState,
  IconButton,
  Kbd,
  SegmentedControl,
  Spinner,
  type SegmentedOption,
} from "../ui";
import "./SqliteTabView.scss";

interface SqliteTabViewProps {
  projectId: string;
}

type SqliteMode = "browse" | "query";

const PAGE_SIZE = 50;
const MODE_OPTIONS: readonly SegmentedOption<SqliteMode>[] = [
  { value: "browse", label: "Browse Table" },
  { value: "query", label: "SQL Runner" },
];

export function SqliteTabView({ projectId }: SqliteTabViewProps) {
  const toast = useToast();
  const [tables, setTables] = useState<SqliteTableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState<SqliteTableRows | null>(null);
  const [offset, setOffset] = useState(0);
  const [loadingTables, setLoadingTables] = useState(true);

  const [sqlInput, setSqlInput] = useState("SELECT name, type FROM sqlite_master WHERE type = 'table';");
  const [queryResult, setQueryResult] = useState<SqliteQueryResult | null>(null);
  const [queryOffset, setQueryOffset] = useState(0);
  const [runningQuery, setRunningQuery] = useState(false);
  const [mode, setMode] = useState<SqliteMode>("browse");

  useEffect(() => {
    setOffset(0);
    setQueryOffset(0);
    setQueryResult(null);
  }, [projectId]);

  const loadTables = useCallback(async () => {
    setLoadingTables(true);
    try {
      const list = await api.sqlite.tables(projectId);
      setTables(list);
      setSelectedTable((current) => {
        if (current && list.some((t) => t.name === current)) return current;
        return list[0]?.name ?? null;
      });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoadingTables(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  const loadTableData = useCallback(
    async (tableName: string, nextOffset: number) => {
      try {
        const rows = await api.sqlite.rows(projectId, tableName, PAGE_SIZE, nextOffset);
        setTableRows(rows);
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
    [projectId, toast],
  );

  useEffect(() => {
    if (!selectedTable) {
      setTableRows(null);
      return;
    }
    void loadTableData(selectedTable, offset);
  }, [selectedTable, offset, loadTableData]);

  const handleRunQuery = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = sqlInput.trim();
    if (!trimmed || runningQuery) return;

    setRunningQuery(true);
    try {
      const result = await api.sqlite.query(projectId, trimmed);
      setQueryResult(result);
      setQueryOffset(0);
      void loadTables();
      if (selectedTable && result.kind === "changes") {
        void loadTableData(selectedTable, offset);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRunningQuery(false);
    }
  };

  const handleSqlKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void handleRunQuery();
    }
  };

  const activeTableInfo = tables.find((t) => t.name === selectedTable) ?? null;

  return (
    <div className="sqlite-tab">
      <aside className="sqlite-tab__sidebar">
        <header className="sqlite-tab__sidebar-head">
          <span className="sqlite-tab__sidebar-title">
            Tables <span>{tables.length}</span>
          </span>
          <IconButton
            size="xs"
            label="Refresh tables"
            icon={<RefreshCw size={13} />}
            onClick={() => void loadTables()}
          />
        </header>

        <div className="sqlite-tab__table-list">
          {loadingTables ? (
            <div className="sqlite-tab__center">
              <Spinner />
            </div>
          ) : tables.length === 0 ? (
            <EmptyState compact description="No tables yet" />
          ) : (
            tables.map((table) => {
              const active = selectedTable === table.name && mode === "browse";
              return (
                <button
                  key={table.name}
                  type="button"
                  className={cx("table-row", active && "table-row--active")}
                  onClick={() => {
                    setSelectedTable(table.name);
                    setOffset(0);
                    setMode("browse");
                  }}
                >
                  <Table2 size={14} className="table-row__icon" />
                  <span className="table-row__name">{table.name}</span>
                  <span className="table-row__count">{table.rowCount}</span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="sqlite-tab__main">
        <header className="sqlite-tab__toolbar">
          <SegmentedControl
            size="sm"
            value={mode}
            options={MODE_OPTIONS}
            onChange={setMode}
            ariaLabel="SQLite view mode"
          />

          {mode === "browse" && activeTableInfo && (
            <div className="sqlite-tab__columns">
              {activeTableInfo.columns.map((col) => (
                <span key={col.name} className="col-chip" title={col.type || "ANY"}>
                  <strong>{col.name}</strong>
                  {col.type && <small>{col.type}</small>}
                  {col.primaryKey && <Badge tone="accent">PK</Badge>}
                </span>
              ))}
            </div>
          )}
        </header>

        {mode === "browse" ? (
          <div className="sqlite-tab__browser">
            {!tableRows ? (
              <EmptyState icon={<Database size={18} />} title="No table selected" />
            ) : (
              <>
                <DataGrid
                  columns={tableRows.columns}
                  rows={tableRows.rows}
                  rowOffset={offset}
                  emptyText={`Table "${tableRows.table}" has 0 rows`}
                />

                <footer className="sqlite-tab__footer">
                  <span className="sqlite-tab__range">
                    {tableRows.rows.length === 0 ? 0 : offset + 1}–{offset + tableRows.rows.length} of {tableRows.total}{" "}
                    rows
                  </span>
                  <div className="sqlite-tab__pager">
                    <Button
                      variant="secondary"
                      size="xs"
                      icon={<ChevronLeft size={13} />}
                      disabled={offset === 0}
                      onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="secondary"
                      size="xs"
                      trailingIcon={<ChevronRight size={13} />}
                      disabled={offset + PAGE_SIZE >= tableRows.total}
                      onClick={() => setOffset(offset + PAGE_SIZE)}
                    >
                      Next
                    </Button>
                  </div>
                </footer>
              </>
            )}
          </div>
        ) : (
          <div className="sqlite-tab__runner">
            <form className="sql-box" onSubmit={(event) => void handleRunQuery(event)}>
              <textarea
                className="sql-box__textarea"
                rows={4}
                value={sqlInput}
                onChange={(event) => setSqlInput(event.target.value)}
                onKeyDown={handleSqlKeyDown}
                placeholder="SELECT * FROM ..."
                spellCheck={false}
              />
              <div className="sql-box__bar">
                <span className="sql-box__hint">
                  <Kbd>Ctrl+Enter</Kbd> to execute
                </span>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  icon={<Play size={12} fill="currentColor" />}
                  loading={runningQuery}
                  disabled={!sqlInput.trim()}
                >
                  {runningQuery ? "Executing…" : "Execute"}
                </Button>
              </div>
            </form>

            {queryResult && (
              <div className="sql-result">
                {queryResult.kind === "changes" ? (
                  <div className="sql-result__changes">
                    Statement executed in <strong>{queryResult.durationMs} ms</strong> · Rows affected:{" "}
                    <strong>{queryResult.changes}</strong>
                    {queryResult.lastInsertRowid !== null && (
                      <>
                        {" "}
                        · Last insert rowid: <strong>{queryResult.lastInsertRowid}</strong>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="sql-result__header">
                      <span>
                        {queryResult.rows.length} row(s) in {queryResult.durationMs} ms
                        {queryResult.truncated ? " (truncated to 1,000 rows)" : ""}
                      </span>
                    </div>
                    <DataGrid
                      columns={queryResult.columns}
                      rows={queryResult.rows.slice(queryOffset, queryOffset + PAGE_SIZE)}
                      rowOffset={queryOffset}
                      emptyText="Query returned 0 rows"
                    />
                    {queryResult.rows.length > PAGE_SIZE && (
                      <footer className="sqlite-tab__footer">
                        <span className="sqlite-tab__range">
                          {queryOffset + 1}–{Math.min(queryOffset + PAGE_SIZE, queryResult.rows.length)} of{" "}
                          {queryResult.rows.length} rows
                        </span>
                        <div className="sqlite-tab__pager">
                          <Button
                            variant="secondary"
                            size="xs"
                            icon={<ChevronLeft size={13} />}
                            disabled={queryOffset === 0}
                            onClick={() => setQueryOffset(Math.max(0, queryOffset - PAGE_SIZE))}
                          >
                            Prev
                          </Button>
                          <Button
                            variant="secondary"
                            size="xs"
                            trailingIcon={<ChevronRight size={13} />}
                            disabled={queryOffset + PAGE_SIZE >= queryResult.rows.length}
                            onClick={() => setQueryOffset(queryOffset + PAGE_SIZE)}
                          >
                            Next
                          </Button>
                        </div>
                      </footer>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
