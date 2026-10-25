import { listClients } from "./clients";
import { listLoans } from "./loans";
import { listSubscriptions } from "./memberships";
import { listMovements } from "./movements";
import { listCardRequests, listCards } from "./cards";
import { FEATURE_CARDS } from "@/lib/feature-flags";
import type { PendingItem } from "./types";
import { money } from "@/lib/format";

const assignments = new Map<string, string | null>();

/**
 * Bandeja única de Pendientes: todo lo que espera una acción humana, de cualquier
 * producto. Se calcula a partir de los datos reales (clientes, préstamos,
 * membresías y movimientos). La asignación a personas se guarda en sesión
 * hasta que exista la tabla `pending_assignments`.
 */
export async function listPending(): Promise<PendingItem[]> {
  const [clients, loans, subs, movements, cardReqs, cards] = await Promise.all([
    listClients(),
    listLoans(),
    listSubscriptions(),
    listMovements(),
    FEATURE_CARDS ? listCardRequests() : Promise.resolve([]),
    FEATURE_CARDS ? listCards() : Promise.resolve([]),
  ]);
  const items: PendingItem[] = [];

  for (const c of clients.filter((x) => x.kyc.status === "por_verificar")) {
    items.push({
      id: `kyc-${c.id}`, kind: "kyc", title: "Identidad por verificar", detail: "INE y datos personales cargados",
      clientName: c.fullName, userId: c.id, relatedId: c.id, createdAt: c.createdAt, priority: "media",
      assignee: null, link: `/admin/general/usuarios/${c.id}`,
    });
  }
  for (const l of loans) {
    const base = { clientName: l.clientName, userId: l.userId, relatedId: l.id, assignee: null };
    if (l.stage === "solicitud")
      items.push({ ...base, id: `sol-${l.id}`, kind: "solicitud_prestamo", title: "Solicitud de préstamo por revisar", detail: `${l.folio} · ${money(l.amount)} en ${l.installments} cuotas`, createdAt: l.appliedAt ?? "", priority: "alta", link: "/admin/prestamos/gestion/solicitudes" });
    if (l.stage === "firma")
      items.push({ ...base, id: `fir-${l.id}`, kind: "firma", title: l.signatureStatus === "Error" ? "Error al enviar contrato" : "Contrato sin firmar", detail: `${l.folio} · enviado ${l.approvedAt ? new Date(l.approvedAt).toLocaleDateString("es-MX") : ""}`, createdAt: l.approvedAt ?? "", priority: l.signatureStatus === "Error" ? "alta" : "media", link: "/admin/prestamos/gestion/firma" });
    if (l.stage === "desembolso")
      items.push({ ...base, id: `des-${l.id}`, kind: "desembolso", title: "Desembolso pendiente", detail: `${l.folio} · ${money(l.amount)}`, createdAt: l.signedAt ?? "", priority: "alta", link: "/admin/prestamos/gestion/desembolso" });
    if (l.stage === "activo" && l.daysOverdue > 0 && !l.portfolioSold)
      items.push({ ...base, id: `atr-${l.id}`, kind: "cuota_atrasada", title: `Cuota atrasada ${l.daysOverdue} días`, detail: `${l.folio} · cuota ${l.paidInstallments + 1} de ${l.installments} · ${money(l.monthlyPayment)}`, createdAt: l.nextPaymentDate ?? "", priority: l.daysOverdue > 30 ? "alta" : "media", link: "/admin/prestamos/cobranza" });
  }
  for (const s of subs.filter((x) => x.status === "active" && x.daysToExpire != null && x.daysToExpire >= 0 && x.daysToExpire <= 15)) {
    items.push({
      id: `mem-${s.id}`, kind: "membresia_por_vencer", title: `Membresía vence en ${s.daysToExpire} días`, detail: `${s.planName} · ${s.autoRenew ? "renovación automática" : "sin renovación automática"}`,
      clientName: s.clientName, userId: s.userId, relatedId: s.id, createdAt: s.expiresAt ?? "", priority: s.autoRenew ? "baja" : "media",
      assignee: null, link: "/admin/membresias/suscripciones/por-vencer",
    });
  }
  for (const m of movements.filter((x) => !x.userId)) {
    items.push({
      id: `mov-${m.id}`, kind: "cobro_sin_cliente", title: "Cobro sin cliente asociado", detail: `${m.provider.toUpperCase()} · ${money(m.amount)} · ref. ${m.reference}`,
      clientName: "—", userId: null, relatedId: m.id, createdAt: m.date, priority: "alta", assignee: null, link: "/admin/general/movimientos",
    });
  }
  for (const r of cardReqs) {
    items.push({
      id: `crq-${r.id}`, kind: "tarjeta_solicitud", title: r.status === "error_onecard" ? "Error de OneCard en alta de tarjeta" : "Solicitud de tarjeta por revisar",
      detail: `${r.membershipName} · línea propuesta ${money(r.creditLine)}`, clientName: r.clientName, userId: r.userId, relatedId: r.id,
      createdAt: r.requestedAt, priority: r.status === "error_onecard" ? "alta" : "media", assignee: null, link: "/admin/tarjetas/solicitudes",
    });
  }
  for (const c of cards.filter((x) => x.status === "reportada")) {
    items.push({
      id: `crd-${c.id}`, kind: "tarjeta_reportada", title: `Tarjeta reportada por ${c.reportReason === "robo" ? "robo" : "extravío"}`, detail: `•••• ${c.lastDigits} · pendiente de reemplazo`,
      clientName: c.clientName, userId: c.userId, relatedId: c.id, createdAt: c.reportedAt ?? "", priority: "alta", assignee: null, link: "/admin/tarjetas/reportadas",
    });
  }
  return items
    .map((i) => ({ ...i, assignee: assignments.get(i.id) ?? i.assignee }))
    .sort((a, b) => {
      const p = { alta: 0, media: 1, baja: 2 };
      return p[a.priority] - p[b.priority] || String(b.createdAt).localeCompare(String(a.createdAt));
    });
}

export function assignPending(id: string, assignee: string | null) {
  assignments.set(id, assignee);
}
