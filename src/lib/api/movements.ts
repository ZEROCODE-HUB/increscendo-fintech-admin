import { requireSupabase } from "@/lib/supabase";
import { apiFetch } from "./http";
import { isDemoMode, wait } from "./source";
import { demoMovements } from "./demo-data";
import { providerForBank } from "./catalogs-data";
import type { Movement, MovementStatus, MovementType } from "./types";

/**
 * Movimientos (registro maestro).
 *
 * Mientras el backend no cree la vista `movements`, la lista se arma con lo que
 * existe en la base de Increscendo:
 *  - Pagos de membresía → `invoices` (si está vacía, se usa `user_memberships`).
 *  - Desembolsos → `loan_disbursements`.
 * Las cuotas cobradas por Belvo solo se pueden pedir por cliente
 * (`/belvo/loans/payment-requests?userId=`), por eso aparecen en la ficha del
 * cliente y no en el listado general. Ver docs/CONTRATOS_BACKEND.md.
 */

export const MOVEMENT_TYPE_LABEL: Record<MovementType, string> = {
  pago_membresia: "Pago de membresía",
  renovacion_membresia: "Renovación de membresía",
  desembolso_prestamo: "Desembolso de préstamo",
  cuota_programada: "Cuota programada",
  cobro_bajo_demanda: "Cobro bajo demanda",
  reembolso: "Reembolso",
  contracargo: "Contracargo",
  recarga_tarjeta: "Recarga de tarjeta",
  consumo_tarjeta: "Consumo con tarjeta",
  pago_servicio: "Pago de servicio",
  transferencia: "Transferencia",
};

export const MOVEMENT_STATUS_LABEL: Record<MovementStatus, string> = {
  exitoso: "Exitoso",
  en_proceso: "En proceso",
  fallido: "Fallido",
  cancelado: "Cancelado",
  reembolsado: "Reembolsado",
};

export const PROVIDER_LABEL: Record<Movement["provider"], string> = {
  conekta: "Conekta",
  respaldo: "Pasarela de respaldo",
  belvo: "Belvo",
  druo: "Druo",
  onecard: "OneCard",
  tekae: "Tekae",
  manual: "Manual",
};

function statusFrom(raw: unknown): MovementStatus {
  const s = String(raw ?? "").toLowerCase();
  if (["paid", "succeeded", "successful", "completed", "active", "exitoso"].includes(s)) return "exitoso";
  if (["failed", "declined", "rejected", "fallido"].includes(s)) return "fallido";
  if (["canceled", "cancelled", "expired"].includes(s)) return "cancelado";
  if (["refunded", "reembolsado"].includes(s)) return "reembolsado";
  return "en_proceso";
}

export async function listMovements(): Promise<Movement[]> {
  if (isDemoMode) {
    await wait();
    return demoMovements.map((m) => ({ ...m }));
  }
  const sb = requireSupabase();
  const [inv, disb, subs] = await Promise.all([
    sb.from("invoices").select("*").order("created_at", { ascending: false }).limit(2000),
    sb
      .from("loan_disbursements")
      .select("id, loan_id, amount, destination_account, created_at, loans(loan_number, user_id, users(first_name, last_name))")
      .order("created_at", { ascending: false })
      .limit(2000),
    sb
      .from("user_memberships")
      .select("id, user_id, status, started_at, created_at, membership_plans(name, price), users(first_name, last_name)")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);
  if (disb.error) throw disb.error;
  const out: Movement[] = [];
  const invoices = (inv.data ?? []) as Record<string, any>[];

  if (invoices.length) {
    // Nombres de clientes para las facturas
    const ids = Array.from(new Set(invoices.map((i) => i.user_id).filter(Boolean)));
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: us } = await sb.from("users").select("id, first_name, last_name").in("id", ids);
      for (const u of (us ?? []) as Record<string, any>[]) names.set(u.id, `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim());
    }
    for (const i of invoices) {
      const failed = statusFrom(i.status) === "fallido";
      out.push({
        id: `inv-${i.id}`,
        date: i.created_at,
        userId: i.user_id ?? null,
        clientName: names.get(i.user_id) || i.customer_name || "—",
        type: i.is_renewal ? "renovacion_membresia" : "pago_membresia",
        product: "membresia",
        direction: "entrada",
        amount: Number(i.amount ?? 0),
        status: i.status ? statusFrom(i.status) : "exitoso",
        provider: i.provider === "respaldo" ? "respaldo" : "conekta",
        method: i.payment_method ?? i.method ?? "Tarjeta",
        reference: i.conekta_order_id ?? i.order_id ?? i.reference ?? String(i.id),
        description: i.description ?? "Pago de membresía",
        relatedId: i.user_membership_id ?? null,
        failedReason: failed ? (i.failure_message ?? i.failure_code ?? null) : null,
      });
    }
  } else {
    for (const s of (subs.data ?? []) as Record<string, any>[]) {
      out.push({
        id: `sub-${s.id}`,
        date: s.started_at ?? s.created_at,
        userId: s.user_id,
        clientName: `${s.users?.first_name ?? ""} ${s.users?.last_name ?? ""}`.trim() || "—",
        type: "pago_membresia",
        product: "membresia",
        direction: "entrada",
        amount: Number(s.membership_plans?.price ?? 0),
        status: s.status === "pending" ? "en_proceso" : s.status === "cancelled" ? "cancelado" : "exitoso",
        provider: "conekta",
        method: "—",
        reference: s.id,
        description: `Membresía ${s.membership_plans?.name ?? ""}`.trim(),
        relatedId: s.id,
        failedReason: null,
      });
    }
  }

  for (const d of (disb.data ?? []) as Record<string, any>[]) {
    const loan = d.loans ?? {};
    out.push({
      id: `disb-${d.id}`,
      date: d.created_at,
      userId: loan.user_id ?? null,
      clientName: `${loan.users?.first_name ?? ""} ${loan.users?.last_name ?? ""}`.trim() || "—",
      type: "desembolso_prestamo",
      product: "prestamo",
      direction: "salida",
      amount: Number(d.amount ?? 0),
      status: "exitoso",
      provider: "manual",
      method: "Transferencia SPEI",
      reference: loan.loan_number ?? d.loan_id,
      description: `Desembolso ${loan.loan_number ?? ""}`.trim(),
      relatedId: d.loan_id,
      failedReason: null,
    });
  }
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/** Movimientos de un cliente: los generales + cuotas de Belvo de ese cliente. */
export async function listClientMovements(userId: string, clientName: string): Promise<Movement[]> {
  const all = await listMovements();
  const own = all.filter((m) => m.userId === userId);
  if (isDemoMode) return own;
  try {
    const rows: Record<string, any>[] = [];
    for (let page = 1; page <= 10; page++) {
      const res = await apiFetch<{ data: Record<string, any>[]; pagination?: { hasMore?: boolean } }>(
        `/belvo/loans/payment-requests?userId=${userId}&page=${page}&limit=50`,
      );
      rows.push(...(res?.data ?? []));
      if (!res?.pagination?.hasMore) break;
    }
    const belvo: Movement[] = rows.map((r) => {
      const n = r.installment_number ?? r.raw?.loan_information?.installmentNumber ?? null;
      return {
        id: `pr-${r.payment_request_id ?? r.reference}`,
        date: r.created_at ?? r.synced_at ?? r.last_updated_at,
        userId,
        clientName,
        type: r.on_demand ? "cobro_bajo_demanda" : "cuota_programada",
        product: "prestamo",
        direction: "entrada",
        amount: Number(r.amount ?? 0),
        status: statusFrom(r.status ?? r.belvo_status),
        provider: providerForBank(r.bank ?? null) ?? "belvo",
        method: "Domiciliación",
        reference: r.payment_request_id ?? r.reference ?? "",
        description: `Cuota ${n ?? "—"} · ${r.loan_number ?? ""}`.trim(),
        relatedId: r.loan_id ?? null,
        failedReason: r.failed_reason ?? null,
      };
    });
    return [...own, ...belvo].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  } catch {
    return own;
  }
}
