import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useId, useMemo } from "react";

/**
 * Paginación controlada para tablas.
 *
 * Pensada para una plataforma densa (backoffice financiero): misma UI y misma
 * API para los casos client-side (dentro de <DataTable />) y server-side
 * (padre dueño del estado con total real).
 *
 * Características:
 *  - Numerada con elipsis inteligente (1 … 4 5 [6] 7 8 … 50).
 *  - Primera / anterior / siguiente / última con iconos.
 *  - Si <= 1 página: muestra el contador igual pero oculta los controles.
 *  - En pantallas chicas (<sm) los números se ocultan y quedan solo los chevrons
 *    (no se rompe layout, sigue siendo usable con teclado).
 *  - Selector de tamaño de página opcional.
 */

export const DEFAULT_PAGE_SIZES = [10, 20, 50] as const;

type Variant = "with-selector" | "compact";

export type PaginationProps = {
  /** Página actual (1-based). */
  page: number;
  /** Total de páginas. */
  totalPages: number;
  /** Cantidad de filas por página (solo se usa si se pasa `onPageSizeChange`). */
  pageSize: number;
  /** Total de registros (para el contador "N resultado(s)"). */
  total: number;
  /** Texto del contador, p. ej. "usuario(s)", "movimiento(s)". */
  countLabel?: string;
  /** Opciones del selector de filas por página. */
  pageSizes?: readonly number[];
  /** Deshabilita toda la interacción (típico mientras llega una query). */
  disabled?: boolean;
  /** Prefija el total con "~" cuando es un conteo estimado. */
  estimated?: boolean;
  /** Variante visual. */
  variant?: Variant;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
};

/**
 * Devuelve la lista de páginas a renderizar como botones, con elipsis "…".
 * Estrategia estándar: siempre mostrar primera, última, actual y vecinas.
 * Si la cantidad de páginas es chica, no hace falta elipsis.
 */
function buildPageItems(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 1) return [];
  // Vecinos a mostrar alrededor del actual (a cada lado).
  const siblings = 1;
  // Siempre incluir primera y última.
  const includeLeft = current - siblings;
  const includeRight = current + siblings;

  const items: (number | "ellipsis")[] = [];

  const push = (n: number) => {
    if (n < 1 || n > total) return;
    if (items[items.length - 1] === n) return;
    items.push(n);
  };

  // Siempre primera
  push(1);

  // Elipsis izquierda si hay hueco entre 1 y el primer vecino
  if (includeLeft > 2) {
    items.push("ellipsis");
  }

  // Rango central
  const start = Math.max(2, includeLeft);
  const end = Math.min(total - 1, includeRight);
  for (let n = start; n <= end; n++) push(n);

  // Elipsis derecha
  if (includeRight < total - 1) {
    items.push("ellipsis");
  }

  // Última
  if (total > 1) push(total);

  return items;
}

/** Botón base, compartido entre páginas. */
function NavButton({
  children,
  active,
  disabled,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  const base =
    "inline-flex h-9 min-w-9 items-center justify-center gap-1 px-2.5 text-sm font-medium transition-colors " +
    "border border-input first:rounded-l-md last:rounded-r-md " +
    "-ml-px focus:relative focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";
  const state = disabled
    ? "opacity-40 cursor-not-allowed pointer-events-none text-muted-foreground bg-card"
    : active
      ? "z-10 bg-primary text-primary-foreground border-primary hover:bg-primary/90"
      : "bg-card text-foreground hover:bg-accent";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      aria-label={ariaLabel}
      className={`${base} ${state}`}
    >
      {children}
    </button>
  );
}

export function Pagination({
  page,
  totalPages,
  pageSize,
  total,
  countLabel,
  pageSizes = DEFAULT_PAGE_SIZES,
  disabled = false,
  estimated = false,
  variant = "with-selector",
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const selectId = useId();
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const isFirst = safePage <= 1;
  const isLast = safePage >= safeTotalPages;
  const hasPages = safeTotalPages > 1;

  const go = (n: number) => {
    if (disabled) return;
    const target = Math.min(safeTotalPages, Math.max(1, n));
    if (target !== safePage) onPageChange(target);
  };

  const items = useMemo(
    () => buildPageItems(safePage, safeTotalPages),
    [safePage, safeTotalPages],
  );

  const renderCount = () => {
    if (!total) return null;
    return (
      <span className="text-muted-foreground text-xs sm:text-sm tabular-nums">
        {estimated ? "~" : ""}
        {total.toLocaleString("es-AR")}
        {countLabel ? <> {countLabel}</> : null}
      </span>
    );
  };

  const renderPageSizeSelector = () => {
    if (variant !== "with-selector" || !onPageSizeChange) return null;
    return (
      <div className="flex items-center gap-2">
        <label
          htmlFor={selectId}
          className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm"
        >
          Filas por página
        </label>
        <select
          id={selectId}
          aria-label="Filas por página"
          className="h-9 px-2 rounded-md border border-input bg-card text-foreground text-xs outline-none focus:ring-2 focus:ring-ring/40 hover:bg-accent transition-colors"
          value={pageSize}
          disabled={disabled}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {pageSizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const renderPosition = () => (
    <span className="hidden sm:inline text-muted-foreground text-xs sm:text-sm whitespace-nowrap tabular-nums">
      Página <span className="text-foreground font-medium">{safePage}</span> de{" "}
      <span className="text-foreground font-medium">{safeTotalPages}</span>
    </span>
  );

  const renderControls = () => {
    if (!hasPages) return null;

    return (
      <nav
        className="flex items-center"
        aria-label="Paginación"
      >
        {/* Primera + Anterior (en sm: solo iconos para ahorrar espacio) */}
        <div className="hidden sm:flex">
          <NavButton
            ariaLabel="Primera página"
            disabled={isFirst || disabled}
            onClick={() => go(1)}
          >
            <ChevronsLeft size={14} />
          </NavButton>
        </div>
        <NavButton
          ariaLabel="Página anterior"
          disabled={isFirst || disabled}
          onClick={() => go(safePage - 1)}
        >
          <ChevronLeft size={14} />
          <span className="hidden sm:inline">Anterior</span>
        </NavButton>

        {/* Números de página (ocultos en <sm) */}
        <div className="hidden sm:flex">
          {items.map((it, idx) =>
            it === "ellipsis" ? (
              <span
                key={`e-${idx}`}
                aria-hidden="true"
                className="inline-flex h-9 min-w-9 items-center justify-center -ml-px border border-input bg-card text-muted-foreground text-sm"
              >
                …
              </span>
            ) : (
              <NavButton
                key={it}
                ariaLabel={`Ir a la página ${it}`}
                active={it === safePage}
                disabled={disabled}
                onClick={() => go(it)}
              >
                {it}
              </NavButton>
            ),
          )}
        </div>

        {/* Siguiente + Última */}
        <NavButton
          ariaLabel="Página siguiente"
          disabled={isLast || disabled}
          onClick={() => go(safePage + 1)}
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight size={14} />
        </NavButton>
        <div className="hidden sm:flex">
          <NavButton
            ariaLabel="Última página"
            disabled={isLast || disabled}
            onClick={() => go(safeTotalPages)}
          >
            <ChevronsRight size={14} />
          </NavButton>
        </div>
      </nav>
    );
  };

  // Variante compact: una sola línea, sin selector de tamaño.
  if (variant === "compact") {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4 text-sm">
        <div className="flex items-center gap-2">
          {renderCount()}
          {renderPosition()}
        </div>
        {renderControls()}
      </div>
    );
  }

  // Variante default.
  return (
    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4 text-sm">
      {/* Izquierda: contador + selector de tamaño */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          {renderCount()}
          {renderPosition()}
        </div>
        {renderPageSizeSelector()}
      </div>

      {/* Derecha: controles */}
      <div className="flex items-center justify-end">{renderControls()}</div>
    </div>
  );
}
