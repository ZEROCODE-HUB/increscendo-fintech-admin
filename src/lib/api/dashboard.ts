import { listClients } from "./clients";
import { listLoans } from "./loans";
import { listSubscriptions } from "./memberships";
import { listMovements } from "./movements";
import { listCards } from "./cards";
import { FEATURE_CARDS } from "@/lib/feature-flags";

export type DashboardData = {
  newClientsWeek: number;
  newClientsPrevWeek: number;
  activeMemberships: number;
  membershipRevenueMonth: number;
  membershipRevenuePrevMonth: number;
  activeLoans: number;
  portfolioOutstanding: number;
  overdueLoans: number;
  overdueAmount: number;
  moraRate: number;
  chargesToday: number;
  chargesWeek: number;
  failedCharges7d: number;
  pendingDisbursementAmount: number;
  activeCards: number;
  cardBalance: number;
  funnel: { label: string; value: number }[];
  monthly: { month: string; altas: number; membresias: number; ingresos: number }[];
  byExecutive: { name: string; altas: number }[];
  aging: { bucket: string; count: number; amount: number }[];
};

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export async function getDashboard(): Promise<DashboardData> {
  const [clients, loans, subs, movements, cards] = await Promise.all([
    listClients(),
    listLoans(),
    listSubscriptions(),
    listMovements(),
    FEATURE_CARDS ? listCards() : Promise.resolve([]),
  ]);
  const now = Date.now();
  const DAY = 86_400_000;
  const inRange = (d: string | null | undefined, from: number, to: number) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    return t >= from && t < to;
  };
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const prevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime();

  const memberPayments = movements.filter((m) => m.product === "membresia" && m.direction === "entrada" && m.status === "exitoso");
  const active = loans.filter((l) => l.stage === "activo" && !l.portfolioSold);
  const overdue = active.filter((l) => l.daysOverdue > 0);
  const outstanding = active.reduce((s, l) => s + Math.max(0, l.totalToPay - l.paidAmount), 0);
  const overdueAmount = overdue.reduce((s, l) => s + l.monthlyPayment, 0);

  const nextIn = (days: number) =>
    active.filter((l) => l.nextPaymentDate && l.daysOverdue === 0 && new Date(l.nextPaymentDate).getTime() - now < days * DAY).length;

  // Embudo acumulado: registro → membresía pagada → identidad verificada → tarjeta activa.
  const withMembership = clients.filter((c) => c.membership && c.membership.status !== "pending");
  const verified = withMembership.filter((c) => c.kyc.status === "verificado");
  const activeCardUsers = new Set(cards.filter((c) => c.status === "activa").map((c) => c.userId));
  const funnel = [
    { label: "Registrados", value: clients.length },
    { label: "Membresía pagada", value: withMembership.length },
    { label: "Identidad verificada", value: verified.length },
    { label: "Tarjeta activada", value: verified.filter((c) => activeCardUsers.has(c.id)).length },
  ];

  const monthly = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - (5 - k), 1);
    const from = d.getTime();
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    return {
      month: MONTHS[d.getMonth()],
      altas: clients.filter((c) => inRange(c.createdAt, from, to)).length,
      membresias: subs.filter((s) => inRange(s.startedAt, from, to)).length,
      ingresos: memberPayments.filter((m) => inRange(m.date, from, to)).reduce((s, m) => s + m.amount, 0),
    };
  });

  const execMap = new Map<string, number>();
  for (const c of clients.filter((x) => inRange(x.createdAt, now - 30 * DAY, now + DAY))) {
    const k = c.executiveName ?? "Registro directo";
    execMap.set(k, (execMap.get(k) ?? 0) + 1);
  }

  const buckets: [string, (d: number) => boolean][] = [
    ["1–7 días", (d) => d >= 1 && d <= 7],
    ["8–30 días", (d) => d >= 8 && d <= 30],
    ["31–60 días", (d) => d >= 31 && d <= 60],
    ["Más de 60", (d) => d > 60],
  ];

  return {
    newClientsWeek: clients.filter((c) => inRange(c.createdAt, now - 7 * DAY, now + DAY)).length,
    newClientsPrevWeek: clients.filter((c) => inRange(c.createdAt, now - 14 * DAY, now - 7 * DAY)).length,
    activeMemberships: subs.filter((s) => s.status === "active").length,
    membershipRevenueMonth: memberPayments.filter((m) => inRange(m.date, monthStart, now + DAY)).reduce((s, m) => s + m.amount, 0),
    membershipRevenuePrevMonth: memberPayments.filter((m) => inRange(m.date, prevMonthStart, monthStart)).reduce((s, m) => s + m.amount, 0),
    activeLoans: active.length,
    portfolioOutstanding: outstanding,
    overdueLoans: overdue.length,
    overdueAmount,
    moraRate: active.length ? overdue.length / active.length : 0,
    chargesToday: nextIn(1),
    chargesWeek: nextIn(7),
    failedCharges7d: movements.filter((m) => m.status === "fallido" && inRange(m.date, now - 7 * DAY, now + DAY)).length,
    pendingDisbursementAmount: loans.filter((l) => l.stage === "desembolso").reduce((s, l) => s + l.amount, 0),
    activeCards: cards.filter((c) => c.status === "activa").length,
    cardBalance: cards.filter((c) => c.status === "activa").reduce((s, c) => s + c.balance, 0),
    funnel,
    monthly,
    byExecutive: Array.from(execMap.entries()).map(([name, altas]) => ({ name, altas })).sort((a, b) => b.altas - a.altas),
    aging: buckets.map(([bucket, fn]) => {
      const ls = overdue.filter((l) => fn(l.daysOverdue));
      return { bucket, count: ls.length, amount: ls.reduce((s, l) => s + l.monthlyPayment, 0) };
    }),
  };
}
