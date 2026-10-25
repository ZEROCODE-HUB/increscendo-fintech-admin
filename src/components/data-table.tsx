import { useState, useMemo, useRef, useEffect, type ReactNode } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Download,
  X,
  Search,
  HelpCircle,
} from "lucide-react";
import { BtnOutline } from "./portal-shell";
import { Pagination } from "./pagination";

export type FilterType = "text" | "date" | "enum";

export type Column<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean | FilterType;
  filterOptions?: string[];
  hint?: string;
  /** Ancho mínimo en píxeles (ej. 120). Si no se define, se calcula según el label. */
  minWidth?: number;
  /** Ancho máximo en píxeles (ej. 300). Si el contenido es más largo, se trunca con ellipsis. */
  maxWidth?: number;
  /** Texto para tooltip al truncar. Si no se define, usa el contenido renderizado. */
  tooltip?: (row: T) => string;
  render: (row: T) => ReactNode;
};

/** Estado de los filtros de la card. En modo client-side lo maneja el componente;
 *  en modo server-side (onServerFilterChange) lo maneja el padre y cada cambio
 *  dispara una re-consulta contra toda la base (no solo la página actual). */
export type TableServerFilters = {
  global: string;
  enums: Record<string, string>;
  dates: Record<string, { from: string; to: string }>;
};

export const EMPTY_TABLE_FILTERS: TableServerFilters = { global: "", enums: {}, dates: {} };

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
  actions?: (row: T) => ReactNode;
  loading?: boolean;
  emptyMessage?: string;
  pageSize?: number;
  selection?: {
    selected: Set<string | number>;
    onToggle: (id: string | number) => void;
    onToggleAll: () => void;
  };
  onDownloadCSV?: (rows: T[]) => void;
  downloadExcel?: (rows: T[]) => void;
  showEnumAllOption?: boolean;
  showDownloadButton?: boolean;
  dateFilterColumns?: string[];
  initialQuery?: string;
  showGlobalFilter?: boolean;
  extraFilters?: ReactNode;
  hidePagination?: boolean;
  /**
   * Filtros server-side controlados: el padre posee el estado (serverFilterState),
   * recibe cada cambio (onServerFilterChange) y debe re-consultar toda la base
   * + resetear la paginación. Desactiva el filtrado client-side y muestra
   * serverResultCount en "N resultados".
   */
  serverFilterState?: TableServerFilters;
  onServerFilterChange?: (filters: TableServerFilters) => void;
  serverResultCount?: number;
};

const PAGE_SIZES = [10, 20, 50];

function parseDateCell(text: string): Date | null {
  const dmy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  return null;
}

function isTextFilterable<T>(col: Column<T>): boolean {
  return col.filterable === true || col.filterable === "text";
}

function isBoolOrText(val: Column<unknown>["filterable"]): val is boolean | "text" {
  return val === true || val === "text";
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  actions,
  loading = false,
  emptyMessage = "Sin datos",
  pageSize: defaultPageSize = 10,
  selection,
  onDownloadCSV,
  downloadExcel,
  showEnumAllOption = true,
  showDownloadButton = true,
  dateFilterColumns,
  initialQuery,
  showGlobalFilter = true,
  extraFilters,
  hidePagination = false,
  serverFilterState,
  onServerFilterChange,
  serverResultCount,
}: DataTableProps<T>) {
  // Modo server-side: los filtros viven en el padre (que re-consulta la base).
  const controlled = !!onServerFilterChange;

  const emitServer = (next: TableServerFilters) => onServerFilterChange?.(next);

  const setEffectiveGlobal = (value: string) => {
    if (controlled) emitServer({ ...(serverFilterState ?? EMPTY_TABLE_FILTERS), global: value });
    else setGlobalQuery(value);
  };
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [globalQuery, setGlobalQuery] = useState(initialQuery ?? "");
  const [enumFilters, setEnumFilters] = useState<Record<string, string>>({});
  const [dateRanges, setDateRanges] = useState<Record<string, { from: string; to: string }>>({});

  const effectiveGlobal = controlled ? serverFilterState?.global ?? "" : globalQuery;
  const effectiveEnums = controlled ? serverFilterState?.enums ?? {} : enumFilters;
  const effectiveDates = controlled ? serverFilterState?.dates ?? {} : dateRanges;

  useEffect(() => {
    if (initialQuery === undefined) return;
    setGlobalQuery(initialQuery);
    setDebouncedQuery(initialQuery);
  }, [initialQuery]);

  const textSearchableCols = useMemo(() => columns.filter((c) => isTextFilterable(c)), [columns]);

  const dateCols = useMemo(
    () =>
      columns.filter(
        (c) => c.filterable === "date" || /fecha|creado|registro|venc|vigencia/i.test(c.label),
      ),
    [columns],
  );

  const enumCols = useMemo(() => columns.filter((c) => c.filterable === "enum"), [columns]);

  const filterCols = useMemo(() => {
    if (dateFilterColumns !== undefined) {
      return dateFilterColumns
        .map((k) => columns.find((c) => c.key === k))
        .filter((c): c is Column<T> => !!c);
    }
    const first = dateCols[0];
    return first ? [first] : [];
  }, [dateFilterColumns, dateCols, columns]);

  const activeDateGroups = filterCols.filter((col) => {
    const range = effectiveDates[col.key];
    return !!(range && (range.from || range.to));
  }).length;

  const specificFilterCount = Object.values(effectiveEnums).filter((v) => v).length + activeDateGroups;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(globalQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [globalQuery]);

  const searchPlaceholder =
    textSearchableCols.length > 0
      ? `Buscar por ${textSearchableCols
          .slice(0, 4)
          .map((c) => c.label.toLowerCase())
          .join(
            ", ",
          )}${textSearchableCols.length > 4 ? ` +${textSearchableCols.length - 4} más` : ""}...`
      : "Buscar...";

  const clearAllFilters = () => {
    if (controlled) {
      emitServer(EMPTY_TABLE_FILTERS);
      return;
    }
    setGlobalQuery("");
    setDebouncedQuery("");
    setEnumFilters({});
    setDateRanges({});
    setPage(1);
  };

  const exportCSV = () => {
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const exportCols = columns.filter((c) => c.key !== "acciones");
    const header = exportCols.map((c) => escape(c.label));
    const lines = sortedData.map((row) =>
      exportCols
        .map((c) => {
          let val = (row as Record<string, unknown>)[c.key];
          if (val === undefined) {
            const rendered = c.render(row);
            val = typeof rendered === "string" || typeof rendered === "number" ? rendered : "";
          }
          return escape(val);
        })
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "datos.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filteredData = useMemo(() => {
    if (controlled) return data;
    return data.filter((row) => {
      if (debouncedQuery.trim()) {
        const q = debouncedQuery.toLowerCase();
        const matched = textSearchableCols.some((col) => {
          const raw = (row as Record<string, unknown>)[col.key];
          const rendered = col.render(row);
          const renderedText =
            typeof rendered === "string" || typeof rendered === "number"
              ? String(rendered)
              : "";
          const text =
            typeof raw === "string" || typeof raw === "number"
              ? String(raw)
              : renderedText;
          return text.toLowerCase().includes(q);
        });
        if (!matched) return false;
      }
      for (const [key, value] of Object.entries(enumFilters)) {
        if (!value) continue;
        const col = columns.find((c) => c.key === key);
        if (!col) continue;
        const raw = (row as Record<string, unknown>)[col.key];
        const rendered = col.render(row);
        const renderedText =
          typeof rendered === "string" || typeof rendered === "number" ? String(rendered) : "";
        const text =
          typeof raw === "string" || typeof raw === "number" ? String(raw) : renderedText;
        if (text !== value && renderedText !== value) return false;
      }
      const dateFilterOk = filterCols.every((col) => {
        const range = dateRanges[col.key] ?? { from: "", to: "" };
        if (!range.from && !range.to) return true;
        const raw = (row as Record<string, unknown>)[col.key];
        const text =
          typeof raw === "string" || typeof raw === "number"
            ? String(raw)
            : String(col.render(row) ?? "");
        const date = parseDateCell(text);
        if (!date) return true;
        if (range.from) {
          const fromDate = new Date(range.from);
          if (date < fromDate) return false;
        }
        if (range.to) {
          const toDate = new Date(range.to);
          toDate.setDate(toDate.getDate() + 1);
          if (date >= toDate) return false;
        }
        return true;
      });
      if (!dateFilterOk) return false;
      return true;
    });
  }, [data, debouncedQuery, textSearchableCols, enumFilters, dateRanges, filterCols, columns, controlled]);

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filteredData;
    const valueOf = (row: T): string | number => {
      const raw = (row as Record<string, unknown>)[col.key];
      if (typeof raw === "number" || typeof raw === "string") return raw;
      const rendered = col.render(row);
      return typeof rendered === "string" || typeof rendered === "number" ? rendered : "";
    };
    return [...filteredData].sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      const cmp =
        typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "es");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredData, sortKey, sortDir, columns]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, enumFilters, dateRanges, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedData = useMemo(() => {
    if (hidePagination) return sortedData;
    const start = (safePage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, safePage, pageSize, hidePagination]);

  const filteredKeys = useMemo(() => filteredData.map(keyExtractor), [filteredData, keyExtractor]);
  const allFilteredSelected =
    selection && filteredKeys.length > 0 && filteredKeys.every((k) => selection.selected.has(k));
  const someSelected = selection && filteredKeys.some((k) => selection.selected.has(k));

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortKey !== columnKey)
      return <ChevronsUpDown size={14} className="text-muted-foreground" />;
    return sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  if (loading) {
    return (
      <div className="bg-card border rounded-lg overflow-hidden animate-pulse">
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  const colspan = columns.length + (selection ? 1 : 0) + (actions ? 1 : 0);
  const showSpecificFilters = filterCols.length > 0 || enumCols.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {controlled ? (serverResultCount ?? data.length) : sortedData.length} resultados
        </span>
        {showDownloadButton && (
          <div className="flex items-center gap-3">
            <BtnOutline onClick={() => (onDownloadCSV ? onDownloadCSV(sortedData) : exportCSV())}>
              <Download size={16} /> Descargar CSV
            </BtnOutline>
            {downloadExcel && (
              <BtnOutline onClick={() => downloadExcel(sortedData)}>
                <Download size={16} /> Descargar Excel
              </BtnOutline>
            )}
          </div>
        )}
      </div>

      {((showGlobalFilter && textSearchableCols.length > 0) || showSpecificFilters) && (
        <div className="bg-card border rounded-lg p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {showGlobalFilter && textSearchableCols.length > 0 && (
              <div className="relative flex-1 max-w-md">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={effectiveGlobal}
                  onChange={(e) => setEffectiveGlobal(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 rounded-md border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring/40 placeholder:text-muted-foreground/50"
                />
                {effectiveGlobal && (
                  <button
                    type="button"
                    onClick={() => {
                      if (controlled) setEffectiveGlobal("");
                      else {
                        setGlobalQuery("");
                        setDebouncedQuery("");
                      }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
            {specificFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors shrink-0"
              >
                <X size={14} />
                Limpiar filtros ({specificFilterCount + (effectiveGlobal ? 1 : 0)})
              </button>
            )}
          </div>

          {(showSpecificFilters || !!extraFilters) && (
            <div className="flex flex-wrap items-end gap-3">
              {extraFilters && <div className="space-y-1 min-w-0">{extraFilters}</div>}
              {filterCols.map((col) => (
                <div key={col.key} className="space-y-1 min-w-0">
                  <label className="text-xs font-medium text-muted-foreground">
                    {col.label} (desde – hasta)
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                    <input
                      type="date"
                      value={effectiveDates[col.key]?.from ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (controlled) {
                          const prev = serverFilterState ?? EMPTY_TABLE_FILTERS;
                          const dates = { ...prev.dates };
                          const cur = dates[col.key] ?? { from: "", to: "" };
                          dates[col.key] = { ...cur, from: v };
                          emitServer({ ...prev, dates });
                        } else {
                          setDateRanges((prev) => ({
                            ...prev,
                            [col.key]: {
                              ...(prev[col.key] ?? { from: "", to: "" }),
                              from: v,
                            },
                          }));
                        }
                      }}
                      className="w-full sm:w-auto sm:flex-1 h-8 px-2 rounded-md border border-input bg-background text-xs outline-none focus:ring-2 focus:ring-ring/40 [color-scheme:light] dark:[color-scheme:dark]"
                    />
                    <span className="text-xs text-muted-foreground shrink-0 self-center sm:self-auto">
                      →
                    </span>
                    <input
                      type="date"
                      value={effectiveDates[col.key]?.to ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (controlled) {
                          const prev = serverFilterState ?? EMPTY_TABLE_FILTERS;
                          const dates = { ...prev.dates };
                          const cur = dates[col.key] ?? { from: "", to: "" };
                          dates[col.key] = { ...cur, to: v };
                          emitServer({ ...prev, dates });
                        } else {
                          setDateRanges((prev) => ({
                            ...prev,
                            [col.key]: {
                              ...(prev[col.key] ?? { from: "", to: "" }),
                              to: v,
                            },
                          }));
                        }
                      }}
                      className="w-full sm:w-auto sm:flex-1 h-8 px-2 rounded-md border border-input bg-background text-xs outline-none focus:ring-2 focus:ring-ring/40 [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>
                </div>
              ))}
              {enumCols.map((col) => (
                <div key={col.key} className="space-y-1 min-w-0">
                  <label className="text-xs font-medium text-muted-foreground">{col.label}</label>
                  <select
                    value={effectiveEnums[col.key] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (controlled) {
                        const prev = serverFilterState ?? EMPTY_TABLE_FILTERS;
                        const enums = { ...prev.enums };
                        if (v) enums[col.key] = v;
                        else delete enums[col.key];
                        emitServer({ ...prev, enums });
                      } else {
                        setEnumFilters((prev) => {
                          const next = { ...prev, [col.key]: v };
                          if (!v) delete next[col.key];
                          return next;
                        });
                      }
                    }}
                    className="w-full sm:w-auto sm:min-w-[130px] h-8 px-2 rounded-md border border-input bg-background text-xs outline-none focus:ring-2 focus:ring-ring/40"
                  >
                    {showEnumAllOption && <option value="">Todos</option>}
                    {(col.filterOptions ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm" style={{ tableLayout: "auto" }}>
          <thead>
            <tr className="border-b bg-muted/50">
              {selection && (
                <th className="px-2 py-2 sm:px-4 sm:py-3 w-10" style={{ minWidth: 40 }}>
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={allFilteredSelected ?? false}
                    ref={(el) => {
                      if (el) el.indeterminate = !!(!allFilteredSelected && someSelected);
                    }}
                    onChange={selection.onToggleAll}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-2 py-2 sm:px-4 sm:py-3 text-left whitespace-nowrap"
                  style={{ minWidth: col.minWidth ?? 100 }}
                >
                  <button
                    type="button"
                    className={`font-display font-semibold text-foreground flex items-center gap-1 ${
                      col.sortable ? "cursor-pointer hover:text-primary" : ""
                    }`}
                    onClick={() => col.sortable && handleSort(col.key)}
                    disabled={!col.sortable}
                  >
                    {col.label}
                    {col.hint && (
                      <span title={col.hint} className="cursor-help text-muted-foreground">
                        <HelpCircle size={12} />
                      </span>
                    )}
                    {col.sortable && <SortIcon columnKey={col.key} />}
                  </button>
                </th>
              ))}
              {actions && (
                <th
                  className="px-2 py-2 sm:px-4 sm:py-3 w-16 text-right whitespace-nowrap sticky right-0 bg-muted shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]"
                  style={{ minWidth: 72 }}
                >
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={colspan}
                  className="px-4 py-8 sm:py-12 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => {
                const key = keyExtractor(row);
                const checked = selection?.selected.has(key) ?? false;
                return (
                  <tr
                    key={key}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    {selection && (
                      <td className="px-2 py-2 sm:px-4 sm:py-3" style={{ minWidth: 40 }}>
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={checked}
                          onChange={() => selection.onToggle(key)}
                        />
                      </td>
                    )}
                    {columns.map((col) => {
                      const rendered = col.render(row);
                      const textContent =
                        typeof rendered === "string" || typeof rendered === "number"
                          ? String(rendered)
                          : "";
                      return (
                        <td
                          key={col.key}
                          className="px-2 py-2 sm:px-4 sm:py-3"
                          style={{
                            minWidth: col.minWidth ?? 100,
                            maxWidth: col.maxWidth,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={col.tooltip ? col.tooltip(row) : textContent || undefined}
                        >
                          {rendered}
                        </td>
                      );
                    })}
                    {actions && (
                      <td
                        className="px-2 py-2 sm:px-4 sm:py-3 text-right sticky right-0 bg-card shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]"
                        style={{ minWidth: 72 }}
                      >
                        {actions(row)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!hidePagination && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          pageSize={pageSize}
          total={sortedData.length}
          pageSizes={PAGE_SIZES}
          countLabel={undefined}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => setPageSize(s)}
        />
      )}
    </div>
  );
}
