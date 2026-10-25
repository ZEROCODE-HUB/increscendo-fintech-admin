import { createPortal } from "react-dom";
import type { ReactNode } from "react";

/** Renderiza modales en <body> para que no queden atrapados en celdas sticky de tablas. */
export function Portal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
