import { wait } from "./source";
import {
  demoCampaigns,
  demoCardMovements,
  demoCardRequests,
  demoCards,
  demoClients,
  demoMaster,
  demoMasterMovements,
  demoRecipients,
} from "./demo-data";
import { logActivity } from "./activity";
import type {
  Campaign,
  CampaignRecipient,
  Card,
  CardMovement,
  CardRequest,
  MasterAccount,
  MasterMovement,
} from "./types";

/**
 * Módulo Tarjetas (OneCard) — Documento de alcance Fase 2.
 *
 * Todas las funciones trabajan con datos de ejemplo hasta que exista la
 * integración con OneCard. Cada una indica el servicio de OneCard que la
 * respalda (ver "Servicios de OneCard que usaremos" en el documento de alcance)
 * y el endpoint que el backend debe exponer (docs/CONTRATOS_BACKEND.md).
 */

/* ───────── A. Campañas ───────── */

export async function listCampaigns(): Promise<Campaign[]> {
  await wait();
  return demoCampaigns.map((c) => ({ ...c }));
}

export async function listRecipients(campaignId?: string): Promise<CampaignRecipient[]> {
  await wait();
  return demoRecipients.filter((r) => !campaignId || r.campaignId === campaignId).map((r) => ({ ...r }));
}

export type CampaignDraftRow = { name: string; email: string; phone: string; valid: boolean; error?: string };

/** Lee el Excel/CSV de destinatarios (columnas: nombre, correo, teléfono). */
export async function parseRecipientsFile(file: File): Promise<CampaignDraftRow[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer());
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const norm = (o: Record<string, unknown>, keys: string[]) => {
    const k = Object.keys(o).find((x) => keys.includes(x.trim().toLowerCase()));
    return k ? String(o[k]).trim() : "";
  };
  const seen = new Set<string>();
  return rows.map((r) => {
    const name = norm(r, ["nombre", "name", "nombre completo"]);
    const email = norm(r, ["correo", "email", "e-mail", "correo electrónico"]).toLowerCase();
    const phone = norm(r, ["telefono", "teléfono", "phone", "celular"]);
    let error: string | undefined;
    if (!name) error = "Falta nombre";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) error = "Correo inválido";
    else if (seen.has(email)) error = "Correo duplicado";
    seen.add(email);
    return { name, email, phone, valid: !error, error };
  });
}

/** Lanza la campaña: genera un token propio por destinatario (vigente 30 días) y envía los correos. */
export async function launchCampaign(name: string, rows: CampaignDraftRow[], createdBy: string): Promise<Campaign> {
  await wait(800);
  const valid = rows.filter((r) => r.valid);
  const expires = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const campaign: Campaign = {
    id: `cmp-${Date.now()}`,
    name,
    createdAt: new Date().toISOString(),
    createdBy,
    recipients: valid.length,
    opened: 0,
    completed: 0,
    activated: 0,
    expiresAt: expires,
    status: "enviando",
  };
  demoCampaigns.unshift(campaign);
  valid.forEach((r, i) =>
    demoRecipients.unshift({
      id: `rcp-${Date.now()}-${i}`,
      campaignId: campaign.id,
      campaignName: name,
      name: r.name,
      email: r.email,
      phone: r.phone,
      status: "enviada",
      updatedAt: campaign.createdAt,
      tokenExpiresAt: expires,
    }),
  );
  void logActivity("Lanzó campaña de tarjetas", "Campaña", name, `${valid.length} destinatarios`);
  return campaign;
}

export async function resendInvitation(r: CampaignRecipient): Promise<void> {
  await wait(300);
  const x = demoRecipients.find((k) => k.id === r.id);
  if (x) {
    x.status = "enviada";
    x.updatedAt = new Date().toISOString();
    x.tokenExpiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
  }
  void logActivity("Reenvió invitación", "Campaña", r.campaignName, r.email);
}

/* ───────── C. Gestión de tarjetas ───────── */

export async function listCardRequests(): Promise<CardRequest[]> {
  await wait();
  return demoCardRequests.filter((r) => r.status === "por_revisar" || r.status === "error_onecard").map((r) => ({ ...r }));
}

/**
 * Aprobar solicitud → OneCard "Alta de tarjeta" + "Carga de saldo" (línea inicial).
 * Después el cliente pasa a Asignación → Contrato → Listo en su app.
 */
export async function approveCardRequest(req: CardRequest, creditLine: number): Promise<void> {
  await wait(900);
  const r = demoCardRequests.find((x) => x.id === req.id);
  if (r) r.status = "aprobada";
  demoCards.unshift({
    id: `card-${Date.now()}`,
    userId: req.userId,
    clientName: req.clientName,
    lastDigits: String(Math.floor(1000 + Math.random() * 9000)),
    kind: "fisica",
    status: "pendiente_entrega",
    balance: creditLine,
    creditLine,
    onlinePurchases: false,
    issuedAt: new Date().toISOString(),
    deliveredAt: null,
    reportedAt: null,
    reportReason: null,
    replacementOf: null,
  });
  demoMaster.balance -= creditLine;
  demoMaster.assignedToday += creditLine;
  demoMaster.assignedMonth += creditLine;
  const c = demoClients.find((x) => x.id === req.userId);
  if (c) c.hasCard = true;
  void logActivity("Aprobó tarjeta", "Tarjeta", req.clientName, `Línea inicial ${creditLine} MXN`);
}

export async function rejectCardRequest(req: CardRequest, reasonCode: string): Promise<void> {
  await wait(400);
  const r = demoCardRequests.find((x) => x.id === req.id);
  if (r) r.status = "rechazada";
  void logActivity("Rechazó tarjeta", "Tarjeta", req.clientName, `Motivo: ${reasonCode}`);
}

/** Reintentar → vuelve a llamar "Alta de tarjeta" cuando OneCard respondió con error. */
export async function retryCardRequest(req: CardRequest): Promise<void> {
  await wait(800);
  const r = demoCardRequests.find((x) => x.id === req.id);
  if (r) {
    r.status = "por_revisar";
    r.errorMessage = null;
  }
  void logActivity("Reintentó alta en OneCard", "Tarjeta", req.clientName);
}

export async function listCards(): Promise<Card[]> {
  await wait();
  return demoCards.map((c) => ({ ...c }));
}

export async function listClientCards(userId: string): Promise<Card[]> {
  await wait(120);
  return demoCards.filter((c) => c.userId === userId).map((c) => ({ ...c }));
}

export async function listCardMovements(cardId: string): Promise<CardMovement[]> {
  await wait(200);
  return demoCardMovements(cardId);
}

/** Recargar saldo → OneCard "Carga de saldo" (sale de la Cuenta Maestra). */
export async function rechargeCard(card: Card, amount: number): Promise<void> {
  if (amount <= 0) throw new Error("El monto debe ser mayor a cero.");
  if (amount > demoMaster.balance) throw new Error("La Cuenta Maestra no tiene saldo suficiente.");
  await wait(600);
  const c = demoCards.find((x) => x.id === card.id);
  if (c) c.balance += amount;
  demoMaster.balance -= amount;
  demoMaster.assignedToday += amount;
  demoMaster.assignedMonth += amount;
  demoMasterMovements.unshift({
    id: `mm-${Date.now()}`, date: new Date().toISOString(), clientName: card.clientName, cardLast: card.lastDigits,
    amount: -amount, kind: "recarga", by: "Administrador",
  });
  void logActivity("Recargó tarjeta", "Tarjeta", `•••• ${card.lastDigits}`, `${amount} MXN`);
}

/** Bloquear / desbloquear → OneCard "Bloquear / desbloquear" (con confirmación previa). */
export async function toggleCardBlock(card: Card): Promise<void> {
  await wait(500);
  const c = demoCards.find((x) => x.id === card.id);
  if (c) c.status = c.status === "activa" ? "bloqueada" : "activa";
  void logActivity(card.status === "activa" ? "Bloqueó tarjeta" : "Desbloqueó tarjeta", "Tarjeta", `•••• ${card.lastDigits}`, card.clientName);
}

export async function markCardDelivered(card: Card): Promise<void> {
  await wait(300);
  const c = demoCards.find((x) => x.id === card.id);
  if (c) {
    c.status = "activa";
    c.deliveredAt = new Date().toISOString();
  }
  void logActivity("Entregó tarjeta", "Tarjeta", `•••• ${card.lastDigits}`, card.clientName);
}

/** Reporte de robo/extravío desde el admin (el cliente también puede reportar desde "Mi tarjeta"). */
export async function reportCard(card: Card, reason: "robo" | "extravio"): Promise<void> {
  await wait(400);
  const c = demoCards.find((x) => x.id === card.id);
  if (c) {
    c.status = "reportada";
    c.reportedAt = new Date().toISOString();
    c.reportReason = reason;
  }
  void logActivity("Reportó tarjeta", "Tarjeta", `•••• ${card.lastDigits}`, reason);
}

/** Reemplazo de plástico → OneCard "Reemplazo de plástico" (transfiere el saldo a la nueva). */
export async function replaceCard(card: Card): Promise<void> {
  await wait(900);
  const c = demoCards.find((x) => x.id === card.id);
  if (!c) return;
  c.status = "reemplazada";
  demoCards.unshift({
    ...c,
    id: `card-${Date.now()}`,
    lastDigits: String(Math.floor(1000 + Math.random() * 9000)),
    status: "pendiente_entrega",
    issuedAt: new Date().toISOString(),
    deliveredAt: null,
    reportedAt: null,
    reportReason: null,
    replacementOf: c.id,
  });
  void logActivity("Reemplazó plástico", "Tarjeta", `•••• ${card.lastDigits}`, card.clientName);
}

export async function getMasterAccount(): Promise<MasterAccount> {
  await wait(200);
  return { ...demoMaster, lastSyncAt: new Date().toISOString() };
}

export async function listMasterMovements(): Promise<MasterMovement[]> {
  await wait(200);
  return demoMasterMovements.map((m) => ({ ...m }));
}

/* ───────── Operaciones (panel técnico) ───────── */

export type OneCardOperation =
  | "consultar_saldo"
  | "consultar_movimientos"
  | "consultar_estatus"
  | "saldo_cuenta_maestra";

/** Consulta manual directa a OneCard (solo rol Técnico/Administrador). */
export async function runOneCardOperation(op: OneCardOperation, cardRef: string): Promise<Record<string, unknown>> {
  await wait(700);
  const card = demoCards.find((c) => c.lastDigits === cardRef.replace(/\D/g, "").slice(-4));
  const now = new Date().toISOString();
  switch (op) {
    case "saldo_cuenta_maestra":
      return { servicio: "SaldoCuentaMaestra", saldo: demoMaster.balance, moneda: "MXN", consultado: now };
    case "consultar_saldo":
      return card
        ? { servicio: "ConsultarSaldo", tarjeta: `•••• ${card.lastDigits}`, saldo: card.balance, consultado: now }
        : { servicio: "ConsultarSaldo", error: "Tarjeta no encontrada", codigo: 404 };
    case "consultar_estatus":
      return card
        ? { servicio: "ConsultarEstatus", tarjeta: `•••• ${card.lastDigits}`, estatus: card.status, comprasEnLinea: card.onlinePurchases }
        : { servicio: "ConsultarEstatus", error: "Tarjeta no encontrada", codigo: 404 };
    default:
      return card
        ? { servicio: "ConsultarMovimientos", tarjeta: `•••• ${card.lastDigits}`, movimientos: demoCardMovements(card.id).slice(0, 5) }
        : { servicio: "ConsultarMovimientos", error: "Tarjeta no encontrada", codigo: 404 };
  }
}
