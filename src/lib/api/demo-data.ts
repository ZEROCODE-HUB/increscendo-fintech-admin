/**
 * Datos de ejemplo (modo demostración y secciones pendientes de backend).
 * Son deterministas (semilla fija) y mutables en memoria para que las acciones
 * del panel se reflejen en pantalla durante una revisión.
 */
import type {
  ActivityEntry,
  BackofficeUser,
  BankAccount,
  Campaign,
  CampaignRecipient,
  CampaignRecipientStatus,
  Card,
  CardMovement,
  CardRequest,
  Client,
  Coupon,
  KycStatus,
  Loan,
  LoanDbStatus,
  MasterAccount,
  MasterMovement,
  MembershipPlan,
  Movement,
  Subscription,
} from "./types";
import { stageFromDb } from "@/lib/loans/status";
import { calculateMonthlyPayment, normalizeMonthlyRate } from "@/lib/loans/schedule";
import { DEFAULT_BANKS, providerForBank } from "./catalogs-data";

let seed = 20261025;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;

const TODAY = new Date();
const daysAgo = (n: number) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  d.setHours(int(8, 19), int(0, 59), 0, 0);
  return d.toISOString();
};
const daysAhead = (n: number) => daysAgo(-n);

const FIRST = [
  "María Lourdes", "José Luis", "Imelda", "Fernando", "Guadalupe", "Juan Carlos", "Verónica", "Ricardo",
  "Alejandra", "Miguel Ángel", "Patricia", "Jorge", "Claudia", "Roberto", "Sofía", "Arturo", "Daniela",
  "Francisco", "Gabriela", "Héctor", "Leticia", "Manuel", "Norma", "Óscar", "Rosa María", "Salvador",
  "Teresa", "Ulises", "Yolanda", "Eduardo", "Adriana", "Raúl", "Mónica", "Sergio", "Karla", "Andrés",
  "Laura", "Ernesto", "Beatriz", "Luis Enrique",
];
const LAST = [
  "Hernández", "García", "Salinas", "Martínez", "López", "González", "Pérez", "Rodríguez", "Sánchez",
  "Ramírez", "Cruz", "Flores", "Gómez", "Morales", "Vázquez", "Reyes", "Jiménez", "Torres", "Díaz",
  "Gutiérrez", "Ruiz", "Mendoza", "Aguilar", "Ortiz", "Castillo", "Moreno", "Romero", "Herrera",
];
const CITIES: [string, string, string][] = [
  ["Puebla", "Puebla", "72000"],
  ["Ciudad de México", "CDMX", "06700"],
  ["Guadalajara", "Jalisco", "44100"],
  ["Monterrey", "Nuevo León", "64000"],
  ["Cholula", "Puebla", "72760"],
  ["Toluca", "Estado de México", "50000"],
  ["Querétaro", "Querétaro", "76000"],
  ["Tlaxcala", "Tlaxcala", "90000"],
];
const COLONIAS = ["Centro", "La Paz", "Anzures", "Roma Norte", "Del Valle", "Las Ánimas", "Jardines", "Bosques"];
const STREETS = ["Av. Juárez", "Calle 5 de Mayo", "Av. Reforma", "Calle Hidalgo", "Blvd. Atlixco", "Calle Morelos"];

function rfcFor(first: string, last: string, birth: string) {
  const l = last.normalize("NFD").replace(/[^A-Z]/gi, "").toUpperCase();
  const f = first.normalize("NFD").replace(/[^A-Z]/gi, "").toUpperCase();
  const d = birth.replace(/-/g, "").slice(2);
  return `${l.slice(0, 2)}${l.slice(-1)}${f[0]}${d}${String.fromCharCode(65 + int(0, 25))}${int(1, 9)}${String.fromCharCode(65 + int(0, 25))}`;
}

/* ─────────────── Backoffice ─────────────── */

export const demoBackoffice: BackofficeUser[] = [
  { id: "bo-1", name: "Héctor Gállego", email: "hector@increscendofintech.com", role: "admin", active: true, location: "Puebla", lastAccessAt: daysAgo(0), clientsRegistered: 18 },
  { id: "bo-2", name: "Juan Pérez", email: "juan.perez@increscendofintech.com", role: "agente", active: true, location: "Puebla", lastAccessAt: daysAgo(1), clientsRegistered: 11 },
  { id: "bo-3", name: "Mariana Ochoa", email: "mariana.ochoa@increscendofintech.com", role: "operaciones", active: true, location: "CDMX", lastAccessAt: daysAgo(0), clientsRegistered: 6 },
  { id: "bo-4", name: "Carlos Bautista", email: "carlos.bautista@increscendofintech.com", role: "cobranza", active: true, location: "Puebla", lastAccessAt: daysAgo(2), clientsRegistered: 0 },
  { id: "bo-5", name: "Lucía Andrade", email: "lucia.andrade@increscendofintech.com", role: "agente", active: false, location: "Tlaxcala", lastAccessAt: daysAgo(40), clientsRegistered: 4 },
  { id: "bo-6", name: "Soporte técnico", email: "soporte@increscendofintech.com", role: "tecnico", active: true, location: null, lastAccessAt: daysAgo(5), clientsRegistered: 0 },
];
const EXECS = demoBackoffice.filter((b) => b.clientsRegistered > 0);

/* ─────────────── Planes ─────────────── */

export const demoPlans: MembershipPlan[] = [
  { id: "plan-basica", name: "Básica", price: 299, currency: "MXN", durationDays: 365, active: true, benefits: ["Pago de servicios", "Recargas de tiempo aire"], targetAudience: "Clientes que solo pagan servicios", interestRate: null, includesCard: false },
  { id: "plan-plus", name: "Plus", price: 500, currency: "MXN", durationDays: 365, active: true, benefits: ["Pago de servicios", "Recargas de tiempo aire", "5% de descuento en servicios", "Tarjeta prepago"], targetAudience: "Clientes frecuentes", interestRate: 0.42, includesCard: true },
  { id: "plan-premium", name: "Premium", price: 1000, currency: "MXN", durationDays: 365, active: true, benefits: ["Todo lo de Plus", "Seguro de gastos médicos", "Tarjeta física", "Atención prioritaria"], targetAudience: "Clientes con mayor uso", interestRate: 0.36, includesCard: true },
  { id: "plan-empresarial", name: "Empresarial", price: 2500, currency: "MXN", durationDays: 365, active: false, benefits: ["Pago a proveedores (próximamente)", "Varias tarjetas"], targetAudience: "Personas morales", interestRate: null, includesCard: true },
];

/* ─────────────── Clientes ─────────────── */

function kycFor(i: number): KycStatus {
  if (i % 9 === 4) return "rechazado";
  if (i % 7 === 3 || i % 11 === 5) return "por_verificar";
  if (i % 13 === 8) return "incompleto";
  return "verificado";
}

export const demoClients: Client[] = Array.from({ length: 42 }, (_, i) => {
  const first = FIRST[i % FIRST.length];
  const last = `${LAST[(i * 3) % LAST.length]} ${LAST[(i * 7 + 2) % LAST.length]}`;
  const birth = `${int(1965, 2000)}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`;
  const [city, state, cp] = pick(CITIES);
  const kyc = kycFor(i);
  const exec = i % 4 === 3 ? null : EXECS[i % EXECS.length];
  const created = daysAgo(int(2, 320));
  const parts = { calle: pick(STREETS), numero: String(int(10, 999)), colonia: pick(COLONIAS), ciudad: city, estado: state, pais: "México", cp };
  const bank = pick(DEFAULT_BANKS.slice(0, 33));
  const isMoral = i === 17 || i === 33;
  const fname = isMoral ? (i === 17 ? "Abarrotes La Esperanza" : "Servicios Integrales Cholula") : first;
  const lname = isMoral ? "S.A. de C.V." : last;
  return {
    id: `cli-${String(i + 1).padStart(3, "0")}`,
    code: `INC${String(i + 1).padStart(3, "0")}`,
    personType: isMoral ? "moral" : "fisica",
    firstName: fname,
    lastName: lname,
    fullName: `${fname} ${lname}`,
    email: `${first.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${last.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}${i}@gmail.com`,
    phone: `+52 222 ${int(100, 999)} ${int(1000, 9999)}`,
    rfc: rfcFor(fname, lname, birth),
    curp: i % 5 === 2 ? "" : `${rfcFor(fname, lname, birth).slice(0, 10)}HPLRRS0${int(1, 9)}`,
    ineKey: `${rfcFor(fname, lname, birth).slice(0, 6)}${int(10000000, 99999999)}H${int(100, 999)}`,
    birthDate: birth,
    address: `${parts.calle} ${parts.numero}, Col. ${parts.colonia}, ${city}, ${state}, CP ${cp}`,
    addressParts: parts,
    createdAt: created,
    avatarUrl: null,
    documents:
      kyc === "incompleto"
        ? { ineFrontUrl: "/demo/ine-frente.svg" }
        : { ineFrontUrl: "/demo/ine-frente.svg", ineBackUrl: "/demo/ine-reverso.svg", curpUrl: i % 3 === 0 ? "/demo/documento.svg" : null, selfieUrl: null, contractUrl: i % 2 === 0 ? "/demo/documento.svg" : null },
    kyc: {
      status: kyc,
      reasonCode: kyc === "rechazado" ? "INE_ILEGIBLE" : null,
      reasonMessage: kyc === "rechazado" ? "Tu INE no se ve legible. Vuelve a tomar la foto con buena luz, sin reflejos ni brillos, y verifica que se lean todos los datos." : null,
      reviewedAt: kyc === "verificado" || kyc === "rechazado" ? daysAgo(int(1, 60)) : null,
      reviewedBy: kyc === "verificado" || kyc === "rechazado" ? "Héctor Gállego" : null,
    },
    executiveId: exec?.id ?? null,
    executiveName: exec?.name ?? null,
    loanEligible: i % 3 === 0,
    collectionProvider: providerForBank(bank.id),
    membership: null,
    loansTotal: 0,
    loansActive: 0,
    hasCard: false,
  };
});

/* ─────────────── Suscripciones ─────────────── */

export const demoSubscriptions: Subscription[] = demoClients
  .filter((_, i) => i % 6 !== 5)
  .map((c, idx) => {
    const plan = demoPlans[idx % 3 === 0 ? 2 : idx % 3 === 1 ? 1 : 0];
    const startedDays = int(5, 360);
    const expires = new Date(daysAgo(startedDays));
    expires.setDate(expires.getDate() + plan.durationDays);
    let status: Subscription["status"] = expires < TODAY ? "expired" : "active";
    if (idx === 7 || idx === 22) status = "pending";
    if (idx === 15) status = "cancelled";
    const dte = Math.round((expires.getTime() - TODAY.getTime()) / 86400000);
    return {
      id: `sub-${idx + 1}`,
      userId: c.id,
      clientName: c.fullName,
      email: c.email,
      planId: plan.id,
      planName: plan.name,
      price: plan.price,
      status,
      startedAt: daysAgo(startedDays),
      expiresAt: expires.toISOString(),
      autoRenew: idx % 2 === 0,
      daysToExpire: dte,
    };
  });
// Algunas por vencer en los próximos días (para el flujo de renovación)
[2, 9, 18, 27].forEach((k, j) => {
  const s = demoSubscriptions[k];
  if (!s) return;
  s.status = "active";
  s.expiresAt = daysAhead(3 + j * 6);
  s.daysToExpire = 3 + j * 6;
});

/* ─────────────── Préstamos ─────────────── */

const LOAN_PLAN: { status: LoanDbStatus; overdue?: number; paid?: number; sold?: boolean }[] = [
  { status: "pending" }, { status: "under_review" }, { status: "pending" }, { status: "pending" },
  { status: "approved" }, { status: "approved" }, { status: "approved" },
  { status: "signed" }, { status: "signed" },
  { status: "active", paid: 2 }, { status: "active", paid: 5 }, { status: "active", paid: 0, overdue: 12 },
  { status: "active", paid: 1, overdue: 4 }, { status: "active", paid: 3, overdue: 38 }, { status: "active", paid: 7 },
  { status: "active", paid: 2, overdue: 67 }, { status: "active", paid: 4 }, { status: "active", paid: 1 },
  { status: "active", paid: 0, overdue: 21 }, { status: "active", paid: 9 },
  { status: "closed", paid: 6 }, { status: "closed", paid: 12 }, { status: "rejected" }, { status: "cancelled" },
  { status: "active", paid: 3, overdue: 95, sold: true },
];

// Regla de negocio: todo cliente con préstamo tiene membresía previa.
const activeMemberIds = new Set(demoSubscriptions.filter((s) => s.status === "active").map((s) => s.userId));
const verifiedWithMembership = demoClients.filter((c) => c.kyc.status === "verificado" && activeMemberIds.has(c.id) && c.personType === "fisica");

export const demoLoans: Loan[] = LOAN_PLAN.map((p, i) => {
  const c = verifiedWithMembership[(i * 5 + 1) % verifiedWithMembership.length];
  const amount = pick([5000, 8000, 10000, 12000, 15000, 20000, 25000, 30000]);
  const installments = pick([3, 6, 6, 9, 12, 12]);
  const rate = pick([0.36, 0.42, 0.48]);
  const monthly = Math.round(calculateMonthlyPayment(amount, normalizeMonthlyRate(rate), installments) * 100) / 100;
  const paid = Math.min(p.paid ?? 0, installments);
  const applied = daysAgo(int(10, 40) + (p.status === "active" || p.status === "closed" ? 30 * (paid + 1) : 0));
  const disbursedDays = p.status === "active" || p.status === "closed" ? 30 * (paid + 1) + (p.overdue ?? 0) - 25 : null;
  const bank = pick(DEFAULT_BANKS.slice(0, 33));
  const next = p.status === "active" ? (p.overdue ? daysAgo(p.overdue) : daysAhead(int(2, 26))) : null;
  return {
    id: `loan-${i + 1}`,
    folio: `INC-${String(1040 + i)}`,
    userId: c.id,
    clientName: c.fullName,
    email: c.email,
    phone: c.phone,
    ineKey: c.ineKey,
    curp: c.curp,
    amount,
    installments,
    monthlyPayment: monthly,
    interestRate: rate,
    totalToPay: Math.round(monthly * installments * 100) / 100,
    dbStatus: p.status,
    stage: stageFromDb(p.status),
    consentStatus: ["pending", "under_review"].includes(p.status) ? (i % 2 ? "confirmed" : "pending") : "confirmed",
    membershipName: demoSubscriptions.find((s) => s.userId === c.id)?.planName ?? "Sin membresía",
    appliedAt: applied,
    approvedAt: ["pending", "under_review", "rejected", "cancelled"].includes(p.status) ? null : daysAgo(int(5, 9) + (disbursedDays ?? 0)),
    signedAt: ["signed", "disbursed", "active", "closed"].includes(p.status) ? daysAgo(int(1, 4) + (disbursedDays ?? 0)) : null,
    disbursedAt: disbursedDays != null ? daysAgo(disbursedDays) : null,
    paidAmount: Math.round(monthly * paid * 100) / 100,
    paidInstallments: paid,
    nextPaymentDate: next,
    lastPaymentDate: paid > 0 ? daysAgo((p.overdue ?? 0) + 30) : null,
    daysOverdue: p.overdue ?? 0,
    bank: bank.id,
    clabe: `0${int(10, 99)}180${int(100000000, 999999999)}${int(1, 9)}`.slice(0, 18),
    signatureStatus: ["signed", "disbursed", "active", "closed"].includes(p.status) ? "Firmado" : i === 6 ? "Error" : "Espera",
    disbursementStatus: ["active", "closed", "disbursed"].includes(p.status) ? "Desembolsado" : "Pendiente",
    rejection: p.status === "rejected" ? { code: "CUENTA_INVALIDA", message: "No pudimos validar tu cuenta bancaria." } : null,
    notices: p.overdue ? [{ sentAt: daysAgo(Math.max(1, (p.overdue ?? 2) - 2)), sentBy: "Carlos Bautista", channel: "email", installment: paid + 1 }] : [],
    portfolioSold: !!p.sold,
    metadata: {},
  };
});

// Totales por cliente
for (const c of demoClients) {
  const sub = demoSubscriptions.filter((s) => s.userId === c.id).sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""))[0];
  c.membership = sub ? { id: sub.id, planId: sub.planId, planName: sub.planName, status: sub.status, startedAt: sub.startedAt, expiresAt: sub.expiresAt } : null;
  const ls = demoLoans.filter((l) => l.userId === c.id);
  c.loansTotal = ls.length;
  c.loansActive = ls.filter((l) => l.dbStatus === "active").length;
  if (ls.length) c.loanEligible = true;
}

export function demoBankAccounts(userId: string): BankAccount[] {
  const loan = demoLoans.find((l) => l.userId === userId);
  const c = demoClients.find((x) => x.id === userId);
  if (!c) return [];
  const bank = loan?.bank ?? "mx_banorte";
  const accounts: BankAccount[] = [
    {
      id: `pm-${userId}-1`,
      bankName: DEFAULT_BANKS.find((b) => b.id === bank)?.name ?? bank,
      clabe: loan?.clabe ?? "072180012345678901",
      lastDigits: (loan?.clabe ?? "8901").slice(-4),
      validationStatus: c.kyc.status === "verificado" ? "validated" : "pending",
      isDefault: true,
      provider: providerForBank(bank),
      createdAt: c.createdAt,
      kind: "cuenta",
    },
  ];
  if (c.membership)
    accounts.push({
      id: `pm-${userId}-2`,
      bankName: "Tarjeta Visa",
      clabe: "",
      lastDigits: String(int(1000, 9999)),
      validationStatus: "validated",
      isDefault: false,
      provider: null,
      createdAt: c.membership.startedAt ?? c.createdAt,
      kind: "tarjeta",
    });
  return accounts;
}

/* ─────────────── Movimientos ─────────────── */

export const demoMovements: Movement[] = (() => {
  const out: Movement[] = [];
  let n = 1;
  for (const s of demoSubscriptions) {
    const failed = n % 11 === 0;
    out.push({
      id: `mov-${n++}`,
      date: s.startedAt ?? daysAgo(30),
      userId: s.userId,
      clientName: s.clientName,
      type: "pago_membresia",
      product: "membresia",
      direction: "entrada",
      amount: s.price,
      status: s.status === "pending" ? "en_proceso" : failed ? "fallido" : "exitoso",
      provider: n % 13 === 0 ? "respaldo" : "conekta",
      method: pick(["Tarjeta de débito", "Tarjeta de crédito", "Link de pago", "Transferencia", "Depósito en efectivo"]),
      reference: `ord_${Math.floor(rnd() * 1e10).toString(36)}`,
      description: `Membresía ${s.planName}`,
      relatedId: s.id,
      failedReason: failed ? "Tarjeta declinada por el banco emisor" : null,
    });
  }
  for (const l of demoLoans) {
    if (l.disbursedAt) {
      out.push({
        id: `mov-${n++}`, date: l.disbursedAt, userId: l.userId, clientName: l.clientName, type: "desembolso_prestamo",
        product: "prestamo", direction: "salida", amount: l.amount, status: "exitoso", provider: "manual",
        method: "Transferencia SPEI", reference: `SPEI-${l.folio}`, description: `Desembolso ${l.folio}`, relatedId: l.id, failedReason: null,
      });
    }
    for (let k = 1; k <= l.paidInstallments; k++) {
      const d = new Date(l.disbursedAt ?? TODAY);
      d.setMonth(d.getMonth() + k);
      out.push({
        id: `mov-${n++}`, date: d.toISOString(), userId: l.userId, clientName: l.clientName,
        type: k % 4 === 0 ? "cobro_bajo_demanda" : "cuota_programada", product: "prestamo", direction: "entrada",
        amount: l.monthlyPayment, status: "exitoso", provider: providerForBank(l.bank) ?? "belvo",
        method: "Domiciliación", reference: `pr_${Math.floor(rnd() * 1e10).toString(36)}`,
        description: `Cuota ${k} de ${l.installments} · ${l.folio}`, relatedId: l.id, failedReason: null,
      });
    }
    if (l.daysOverdue > 0) {
      out.push({
        id: `mov-${n++}`, date: daysAgo(l.daysOverdue), userId: l.userId, clientName: l.clientName, type: "cuota_programada",
        product: "prestamo", direction: "entrada", amount: l.monthlyPayment, status: "fallido",
        provider: providerForBank(l.bank) ?? "belvo", method: "Domiciliación", reference: `pr_${Math.floor(rnd() * 1e10).toString(36)}`,
        description: `Cuota ${l.paidInstallments + 1} de ${l.installments} · ${l.folio}`, relatedId: l.id,
        failedReason: pick(["insufficient_funds", "account_invalid", "consent_not_confirmed"]),
      });
    }
  }
  out.push({
    id: `mov-${n++}`, date: daysAgo(3), userId: null, clientName: "Sin cliente asociado", type: "cuota_programada",
    product: "prestamo", direction: "entrada", amount: 1850, status: "exitoso", provider: "druo", method: "Domiciliación",
    reference: "druo_tx_7f3a91", description: "Cargo en Druo sin cliente asociado", relatedId: null, failedReason: null,
  });
  out.push({
    id: `mov-${n++}`, date: daysAgo(9), userId: demoClients[3].id, clientName: demoClients[3].fullName, type: "contracargo",
    product: "membresia", direction: "salida", amount: 500, status: "exitoso", provider: "conekta", method: "Tarjeta de crédito",
    reference: "chb_29dk1", description: "Contracargo de membresía Plus", relatedId: null, failedReason: null,
  });
  return out.sort((a, b) => b.date.localeCompare(a.date));
})();

/* ─────────────── Cupones ─────────────── */

export const demoCoupons: Coupon[] = [
  { id: "cp-1", code: "BIENVENIDA10", discountPercent: 10, discountAmount: null, active: true, maxRedemptions: 200, redeemedCount: 47, startsAt: daysAgo(60), endsAt: daysAhead(60) },
  { id: "cp-2", code: "PUEBLA100", discountPercent: null, discountAmount: 100, active: true, maxRedemptions: 50, redeemedCount: 12, startsAt: daysAgo(20), endsAt: daysAhead(10) },
  { id: "cp-3", code: "BUENFIN", discountPercent: 20, discountAmount: null, active: false, maxRedemptions: 100, redeemedCount: 100, startsAt: daysAgo(340), endsAt: daysAgo(330) },
];

/* ─────────────── Actividad ─────────────── */

export const demoActivity: ActivityEntry[] = [
  ["Héctor Gállego", "Aprobó identidad", "Cliente", demoClients[0].code, "INE y RFC verificados"],
  ["Juan Pérez", "Dio de alta cliente", "Cliente", demoClients[5].code, "Alta asistida desde Puebla"],
  ["Carlos Bautista", "Envió aviso de cobranza", "Préstamo", "INC-1051", "Cuota 2 de 6"],
  ["Mariana Ochoa", "Registró desembolso", "Préstamo", "INC-1049", "Voucher adjunto"],
  ["Héctor Gállego", "Rechazó solicitud", "Préstamo", "INC-1062", "Motivo: CUENTA_INVALIDA"],
  ["Héctor Gállego", "Editó plan", "Membresía", "Plus", "Beneficios actualizados"],
  ["Carlos Bautista", "Ejecutó cobro bajo demanda", "Préstamo", "INC-1053", "Cuota 4 vía Belvo"],
  ["Mariana Ochoa", "Reenvió contrato", "Préstamo", "INC-1045", "SignNow"],
  ["Juan Pérez", "Subió documentos", "Cliente", demoClients[9].code, "INE frente y reverso"],
  ["Héctor Gállego", "Cambió rol", "Usuario backoffice", "Juan Pérez", "Operaciones → Agente comercial"],
].map(([user, action, entity, entityId, detail], i) => ({ id: `act-${i}`, at: daysAgo(i * 0.7), user, action, entity, entityId, detail }));

/* ─────────────── Tarjetas (OneCard) ─────────────── */

export const demoCampaigns: Campaign[] = [
  { id: "cmp-1", name: "Socios Premium — Puebla", createdAt: daysAgo(18), createdBy: "Héctor Gállego", recipients: 64, opened: 51, completed: 29, activated: 17, expiresAt: daysAhead(12), status: "activa" },
  { id: "cmp-2", name: "Lanzamiento tarjeta física", createdAt: daysAgo(6), createdBy: "Héctor Gállego", recipients: 120, opened: 58, completed: 11, activated: 2, expiresAt: daysAhead(24), status: "activa" },
  { id: "cmp-3", name: "Piloto equipo interno", createdAt: daysAgo(45), createdBy: "Mariana Ochoa", recipients: 12, opened: 12, completed: 12, activated: 11, expiresAt: daysAgo(15), status: "cerrada" },
];

const RECIPIENT_FLOW: CampaignRecipientStatus[] = ["enviada", "abierta", "identidad", "membresia", "en_revision", "aprobada", "contrato", "lista", "activa", "rechazada", "expirada"];

export const demoRecipients: CampaignRecipient[] = Array.from({ length: 36 }, (_, i) => {
  const cmp = demoCampaigns[i % 3];
  const first = FIRST[(i * 7) % FIRST.length];
  const last = LAST[(i * 5) % LAST.length];
  return {
    id: `rcp-${i + 1}`,
    campaignId: cmp.id,
    campaignName: cmp.name,
    name: `${first} ${last}`,
    email: `${first.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${last.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}@correo.mx`,
    phone: `+52 222 ${int(100, 999)} ${int(1000, 9999)}`,
    status: cmp.status === "cerrada" ? (i % 6 === 0 ? "expirada" : "activa") : RECIPIENT_FLOW[i % 9],
    updatedAt: daysAgo(int(0, 15)),
    tokenExpiresAt: cmp.expiresAt,
  };
});

export const demoCardRequests: CardRequest[] = demoClients
  .filter((c) => c.membership?.status === "active")
  .slice(0, 9)
  .map((c, i) => ({
    id: `creq-${i + 1}`,
    userId: c.id,
    clientName: c.fullName,
    email: c.email,
    membershipName: c.membership?.planName ?? "—",
    kycStatus: c.kyc.status,
    requestedAt: daysAgo(int(0, 6)),
    creditLine: pick([1000, 1500, 2000, 3000]),
    status: i === 2 ? "error_onecard" : "por_revisar",
    errorMessage: i === 2 ? "OneCard respondió 503 en Alta de tarjeta. Reintentar." : null,
    campaignName: i % 2 === 0 ? demoCampaigns[0].name : demoCampaigns[1].name,
  }));

export const demoCards: Card[] = demoClients
  .filter((c) => c.kyc.status === "verificado" && c.membership?.status === "active")
  .slice(0, 14)
  .map((c, i) => {
    const reported = i === 4 || i === 9;
    c.hasCard = true;
    return {
      id: `card-${i + 1}`,
      userId: c.id,
      clientName: c.fullName,
      lastDigits: String(int(1000, 9999)),
      kind: i % 3 === 0 ? "virtual" : "fisica",
      status: reported ? "reportada" : i === 6 ? "bloqueo_temporal" : i === 11 ? "pendiente_entrega" : "activa",
      balance: Math.round(rnd() * 2500 * 100) / 100,
      creditLine: pick([1000, 1500, 2000, 3000]),
      onlinePurchases: i % 4 !== 0,
      issuedAt: daysAgo(int(10, 120)),
      deliveredAt: i === 11 ? null : daysAgo(int(5, 100)),
      reportedAt: reported ? daysAgo(int(0, 5)) : null,
      reportReason: reported ? (i === 4 ? "robo" : "extravio") : null,
      replacementOf: null,
    };
  });

export function demoCardMovements(cardId: string): CardMovement[] {
  const store = ["OXXO", "Walmart Supercenter", "Farmacias Guadalajara", "Soriana", "Uber", "Mercado Libre", "Cajero BBVA", "Chedraui"];
  return Array.from({ length: 12 }, (_, i) => {
    const type: CardMovement["type"] = i === 0 ? "recarga" : i % 5 === 0 ? "retiro" : i === 7 ? "comision" : "compra";
    return {
      id: `${cardId}-m${i}`,
      cardId,
      date: daysAgo(i * 3 + 1),
      description: type === "recarga" ? "Recarga desde Cuenta Maestra" : type === "comision" ? "Comisión por retiro" : store[i % store.length],
      amount: type === "recarga" ? 1000 : -Math.round((rnd() * 600 + 40) * 100) / 100,
      type,
    };
  });
}

export const demoMaster: MasterAccount = {
  balance: 184_350.75,
  assignedToday: 6_500,
  assignedMonth: 48_200,
  lastSyncAt: daysAgo(0),
};

export const demoMasterMovements: MasterMovement[] = demoCards
  .flatMap((c, i): MasterMovement[] => [
    { id: `mm-${i}-a`, date: c.issuedAt, clientName: c.clientName, cardLast: c.lastDigits, amount: -c.creditLine, kind: "carga_inicial" as const, by: "Héctor Gállego" },
    ...(i % 3 === 0 ? [{ id: `mm-${i}-b`, date: daysAgo(int(1, 9)), clientName: c.clientName, cardLast: c.lastDigits, amount: -500, kind: "recarga" as const, by: "Mariana Ochoa" }] : []),
  ])
  .concat([{ id: "mm-fondeo", date: daysAgo(14), clientName: "Increscendo Fintech", cardLast: "—", amount: 150000, kind: "fondeo", by: "OneCard" }])
  .sort((a, b) => b.date.localeCompare(a.date));

// Movimientos de tarjeta: cargas desde la Cuenta Maestra (los consumos del cliente viven en el detalle de cada tarjeta).
demoCards.forEach((c, i) => {
  demoMovements.push({
    id: `mov-card-${i}-a`, date: c.issuedAt, userId: c.userId, clientName: c.clientName, type: "recarga_tarjeta",
    product: "tarjeta", direction: "salida", amount: c.creditLine, status: "exitoso", provider: "onecard",
    method: "Cuenta Maestra", reference: `oc_${c.lastDigits}_alta`, description: `Carga inicial · tarjeta •••• ${c.lastDigits}`,
    relatedId: c.id, failedReason: null,
  });
});
demoMovements.sort((a, b) => b.date.localeCompare(a.date));
