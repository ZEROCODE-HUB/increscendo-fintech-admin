import type { BadgeTone } from "@/components/portal-shell";
import type { InstallmentStatus, Loan, LoanDbStatus, LoanStage } from "@/lib/api/types";

/** Estatus de BD → etapa operativa (pestaña de Préstamos › Gestión). */
export function stageFromDb(status: LoanDbStatus): LoanStage {
  switch (status) {
    case "pending":
    case "under_review":
      return "solicitud";
    case "approved":
      return "firma";
    case "signed":
    case "disbursed":
      return "desembolso";
    case "active":
      return "activo";
    default:
      return "cerrado";
  }
}

export const STAGE_DB_STATUSES: Record<LoanStage, LoanDbStatus[]> = {
  solicitud: ["pending", "under_review"],
  firma: ["approved"],
  desembolso: ["signed", "disbursed"],
  activo: ["active"],
  cerrado: ["closed", "paid", "cancelled", "rejected"],
};

export const STAGE_LABEL: Record<LoanStage, string> = {
  solicitud: "Solicitud",
  firma: "En firma",
  desembolso: "Por desembolsar",
  activo: "Activo",
  cerrado: "Cerrado",
};

/** Etiqueta visible del estatus combinando etapa + mora + cierre. */
export function loanStatusLabel(loan: Loan): { label: string; tone: BadgeTone } {
  if (loan.portfolioSold) return { label: "Cartera vendida", tone: "neutral" };
  switch (loan.dbStatus) {
    case "pending":
      return { label: "Pendiente", tone: "warn" };
    case "under_review":
      return { label: "En revisión", tone: "warn" };
    case "approved":
      return { label: "Firma pendiente", tone: "info" };
    case "signed":
      return { label: "Firmado", tone: "info" };
    case "disbursed":
      return { label: "Desembolsado", tone: "success" };
    case "active":
      if (loan.daysOverdue > 30) return { label: `Atrasado ${loan.daysOverdue} d`, tone: "danger" };
      if (loan.daysOverdue > 0) return { label: `Atrasado ${loan.daysOverdue} d`, tone: "warn" };
      return { label: "Al día", tone: "success" };
    case "closed":
    case "paid":
      return { label: "Liquidado", tone: "success" };
    case "rejected":
    case "cancelled":
      return { label: "Rechazado", tone: "danger" };
    default:
      return { label: loan.dbStatus, tone: "neutral" };
  }
}

/** Tramo de mora para Cobranza. */
export function agingBucket(days: number): "al_dia" | "1-7" | "8-30" | "31-60" | "60+" {
  if (days <= 0) return "al_dia";
  if (days <= 7) return "1-7";
  if (days <= 30) return "8-30";
  if (days <= 60) return "31-60";
  return "60+";
}

/**
 * Regla para "Ejecutar cobro" y "Enviar aviso de cobranza".
 * Héctor pidió que estén en todas las pestañas. Se muestran siempre, pero
 * deshabilitadas (con explicación) cuando no hay cuotas que cobrar, para no
 * disparar un cargo indebido por Belvo/Druo.
 */
export function collectionAvailability(loan: Loan): { enabled: boolean; reason: string } {
  if (loan.portfolioSold) return { enabled: false, reason: "La cartera de este préstamo fue vendida." };
  switch (loan.stage) {
    case "solicitud":
      return { enabled: false, reason: "La solicitud aún no está aprobada: no hay cuotas que cobrar." };
    case "firma":
      return { enabled: false, reason: "El contrato aún no está firmado: no hay cuotas que cobrar." };
    case "desembolso":
      return { enabled: false, reason: "El préstamo aún no se desembolsa: las cuotas empiezan después." };
    case "cerrado":
      return { enabled: false, reason: "El préstamo está cerrado: no tiene saldo pendiente." };
    default:
      if (loan.paidInstallments >= loan.installments)
        return { enabled: false, reason: "Todas las cuotas están pagadas." };
      return { enabled: true, reason: "" };
  }
}

export const INSTALLMENT_LABEL: Record<InstallmentStatus, { label: string; tone: BadgeTone }> = {
  pagado: { label: "Pagado", tone: "success" },
  pendiente: { label: "Pendiente", tone: "neutral" },
  en_proceso: { label: "En proceso", tone: "info" },
  rechazado: { label: "Rechazado", tone: "danger" },
  cancelado: { label: "Cancelado", tone: "neutral" },
  contracargo: { label: "Contracargo", tone: "danger" },
  atrasado: { label: "Atrasado", tone: "warn" },
};

/** Estatus de cuota que entrega Belvo → estatus interno. */
export function mapBelvoInstallmentStatus(raw: string | null | undefined, dueDate: string | null): InstallmentStatus {
  const s = String(raw ?? "").toLowerCase();
  if (["paid", "completed", "successful", "succeeded"].includes(s)) return "pagado";
  if (["initial", "processing", "in_progress"].includes(s)) return "en_proceso";
  if (s === "failed") return "rechazado";
  if (["canceled", "cancelled"].includes(s)) return "cancelado";
  if (s === "chargeback") return "contracargo";
  if (dueDate && new Date(dueDate) < new Date()) return "atrasado";
  return "pendiente";
}

/** Motivos de fallo de Belvo traducidos (los mismos del admin actual). */
export const BELVO_FAILED_REASON: Record<string, string> = {
  account_invalid: "Cuenta inválida",
  canceled_by_operations: "Cancelado por operaciones",
  canceled_by_merchant: "Cancelado por el comercio",
  consent_not_confirmed: "Consentimiento no confirmado",
  customer_blocked: "Cliente bloqueado",
  document_invalid: "Documento inválido",
  high_risk: "Riesgo alto",
  high_risk_institution: "Riesgo alto en institución",
  transaction_limits_exceeded: "Límite de transacción excedido",
  insufficient_funds: "Fondos insuficientes",
};

export function failedReasonLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return BELVO_FAILED_REASON[code] ?? code;
}
