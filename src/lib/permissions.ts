import { useAuth } from "@/lib/auth";
import type { BackofficeRole } from "@/lib/api/types";

/**
 * Matriz de permisos del backoffice.
 *
 * Fuente de verdad provisional en el front (UX). La validación real debe vivir
 * en RLS / backend. Cuando exista la tabla `backoffice_roles`, esta matriz se
 * reemplaza por la que devuelva el backend (mismo formato).
 */
export type Resource =
  | "dashboard"
  | "clientes"
  | "clientes.identidad"
  | "clientes.alta"
  | "movimientos"
  | "pendientes"
  | "prestamos"
  | "prestamos.aprobar"
  | "prestamos.cobro"
  | "prestamos.desembolso"
  | "membresias"
  | "membresias.planes"
  | "tarjetas"
  | "tarjetas.saldo"
  | "tarjetas.operaciones"
  | "backoffice"
  | "reportes"
  | "registros"
  | "sistema";

export type Action = "ver" | "editar";

export { ROLE_LABEL, ROLE_DESCRIPTION } from "@/lib/roles";

type Matrix = Partial<Record<Resource, Action[]>>;

const ALL: Action[] = ["ver", "editar"];
const VIEW: Action[] = ["ver"];

export const PERMISSIONS: Record<BackofficeRole, Matrix> = {
  admin: Object.fromEntries(
    (
      [
        "dashboard", "clientes", "clientes.identidad", "clientes.alta", "movimientos", "pendientes",
        "prestamos", "prestamos.aprobar", "prestamos.cobro", "prestamos.desembolso", "membresias",
        "membresias.planes", "tarjetas", "tarjetas.saldo", "tarjetas.operaciones", "backoffice",
        "reportes", "registros", "sistema",
      ] as Resource[]
    ).map((r) => [r, ALL]),
  ) as Matrix,
  operaciones: {
    dashboard: VIEW, clientes: ALL, "clientes.identidad": ALL, "clientes.alta": ALL, movimientos: VIEW,
    pendientes: ALL, prestamos: ALL, "prestamos.aprobar": ALL, "prestamos.desembolso": ALL,
    "prestamos.cobro": ALL, membresias: ALL, "membresias.planes": VIEW, tarjetas: ALL, "tarjetas.saldo": ALL,
    reportes: VIEW, registros: VIEW,
  },
  agente: {
    dashboard: VIEW, clientes: ALL, "clientes.alta": ALL, pendientes: VIEW, membresias: VIEW, tarjetas: VIEW,
    reportes: VIEW,
  },
  cobranza: {
    dashboard: VIEW, clientes: VIEW, movimientos: VIEW, pendientes: ALL, prestamos: VIEW, "prestamos.cobro": ALL,
    membresias: VIEW, reportes: VIEW,
  },
  lectura: {
    dashboard: VIEW, clientes: VIEW, movimientos: VIEW, pendientes: VIEW, prestamos: VIEW, membresias: VIEW,
    "membresias.planes": VIEW, tarjetas: VIEW, reportes: VIEW, registros: VIEW,
  },
  tecnico: {
    dashboard: VIEW, tarjetas: VIEW, "tarjetas.operaciones": ALL, sistema: ALL, registros: VIEW,
  },
};

export function can(role: BackofficeRole | null | undefined, resource: Resource, action: Action = "ver"): boolean {
  if (!role) return false;
  return PERMISSIONS[role]?.[resource]?.includes(action) ?? false;
}

export function useCan(resource: Resource, action: Action = "ver"): boolean {
  const { profile } = useAuth();
  return can(profile?.role, resource, action);
}
