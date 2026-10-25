import type { Installment, Loan } from "@/lib/api/types";

/**
 * Cálculo de tabla de amortización (sistema francés) y PDF que se adjunta
 * a la invitación de firma de SignNow. Portado tal cual del admin actual
 * de Increscendo para no cambiar el documento que recibe el cliente.
 */

export type AmortizationRow = {
  installment: number;
  date: Date;
  principal: number;
  interest: number;
  total: number;
  balance: number;
};

export function normalizeMonthlyRate(annualRate: number): number {
  if (!Number.isFinite(annualRate) || annualRate <= 0) return 0;
  if (annualRate > 1) return annualRate / 100 / 12;
  return annualRate / 12;
}

export function calculateMonthlyPayment(principal: number, monthlyRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  if (monthlyRate <= 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

export function buildFrenchSchedule(
  principal: number,
  monthlyRate: number,
  months: number,
  monthlyPayment: number,
  startDate: Date,
): AmortizationRow[] {
  const rows: AmortizationRow[] = [];
  let remaining = principal;
  for (let i = 1; i <= months; i++) {
    const interest = remaining * monthlyRate;
    let principalPayment = monthlyPayment - interest;
    if (i === months) principalPayment = remaining;
    remaining = Math.max(0, remaining - principalPayment);
    rows.push({
      installment: i,
      date: new Date(startDate.getFullYear(), startDate.getMonth() + (i - 1), startDate.getDate()),
      principal: principalPayment,
      interest,
      total: monthlyPayment,
      balance: remaining,
    });
  }
  return rows;
}

/**
 * Cronograma calculado (respaldo cuando Belvo aún no tiene cuotas, p. ej. antes
 * del desembolso). Marca como pagadas las primeras `paidInstallments`.
 */
export function computedInstallments(loan: Loan): Installment[] {
  const start = loan.disbursedAt ? new Date(loan.disbursedAt) : new Date();
  const first = new Date(start.getFullYear(), start.getMonth() + 1, start.getDate());
  const rate = normalizeMonthlyRate(loan.interestRate);
  const payment = loan.monthlyPayment || calculateMonthlyPayment(loan.amount, rate, loan.installments);
  const today = new Date();
  return buildFrenchSchedule(loan.amount, rate, loan.installments, payment, first).map((r) => {
    const paid = r.installment <= loan.paidInstallments;
    const overdue = !paid && loan.stage === "activo" && r.date < today;
    return {
      number: r.installment,
      dueDate: r.date.toISOString().slice(0, 10),
      amount: Math.round(r.total * 100) / 100,
      status: paid ? "pagado" : overdue ? "atrasado" : "pendiente",
      paidAt: paid ? r.date.toISOString() : null,
      paymentRequestId: null,
      failedReason: null,
    };
  });
}

const money = (v: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(v);
const short = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/** PDF de la tabla de amortización en base64 (para SignNow). */
export async function generateSchedulePdfBase64(loan: Loan): Promise<string> {
  const { jsPDF } = await import("jspdf");
  const principal = loan.amount;
  const months = loan.installments;
  const storedAnnualRate = loan.interestRate || 0.42;
  const monthlyRate = normalizeMonthlyRate(storedAnnualRate);
  const monthlyPayment = loan.monthlyPayment || calculateMonthlyPayment(principal, monthlyRate, months);
  const first = new Date();
  first.setMonth(first.getMonth() + 1);
  const rows = buildFrenchSchedule(principal, monthlyRate, months, monthlyPayment, first);
  const totalToPay = loan.totalToPay || monthlyPayment * months;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 34;
  const right = pageWidth - 34;
  const rowHeight = 18;
  const tableTop = 146;
  const annualPercent = (storedAnnualRate > 1 ? storedAnnualRate : storedAnnualRate * 100).toFixed(2);
  const columns = [
    { label: "CUOTA", width: 50, align: "center" as const },
    { label: "FECHA", width: 84, align: "center" as const },
    { label: "CAPITAL", width: 93, align: "right" as const },
    { label: "INTERES", width: 93, align: "right" as const },
    { label: "TOTAL", width: 93, align: "right" as const },
    { label: "SALDO", width: 93, align: "right" as const },
  ];
  const tableWidth = columns.reduce((s, c) => s + c.width, 0);
  const colX = (i: number) => left + columns.slice(0, i).reduce((s, c) => s + c.width, 0);
  const cell = (text: string, i: number, y: number) => {
    const c = columns[i];
    const x = colX(i);
    if (c.align === "right") doc.text(text, x + c.width - 6, y, { align: "right" });
    else doc.text(text, x + c.width / 2, y, { align: "center" });
  };
  const header = () => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(21, 77, 156);
    doc.setFontSize(17);
    doc.text("Tabla de amortizacion", pageWidth / 2, 46, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(44, 44, 44);
    doc.setFontSize(9);
    doc.text(`Cliente: ${loan.clientName}`, left, 66);
    doc.text(`Solicitud: ${loan.folio}`, left, 80);
    doc.text(`Pagos: ${months}`, left, 94);
    doc.text(`Monto: ${money(principal)}`, right, 66, { align: "right" });
    doc.text(`Pago mensual: ${money(monthlyPayment)}`, right, 80, { align: "right" });
    doc.text(`Total a pagar: ${money(totalToPay)}`, right, 94, { align: "right" });
    doc.text(`TNA: ${annualPercent}%`, left, 108);
    doc.setDrawColor(196, 204, 214);
    doc.line(left, 118, right, 118);
  };
  const tableHeader = (y: number) => {
    doc.setFillColor(234, 239, 246);
    doc.rect(left, y - 11, tableWidth, 18, "F");
    doc.setDrawColor(188, 196, 206);
    doc.rect(left, y - 11, tableWidth, 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(46, 46, 46);
    columns.forEach((c, i) => cell(c.label, i, y));
  };
  header();
  tableHeader(tableTop);
  doc.setFont("helvetica", "normal");
  let y = tableTop + 16;
  rows.forEach((r, idx) => {
    if (y > pageHeight - 84) {
      doc.addPage();
      header();
      tableHeader(tableTop);
      doc.setFont("helvetica", "normal");
      y = tableTop + 16;
    }
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 253);
      doc.rect(left, y - 10, tableWidth, rowHeight, "F");
    }
    doc.setDrawColor(225, 230, 236);
    doc.line(left, y + 8, left + tableWidth, y + 8);
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    cell(String(r.installment), 0, y);
    cell(short(r.date), 1, y);
    cell(money(r.principal), 2, y);
    cell(money(r.interest), 3, y);
    cell(money(r.total), 4, y);
    cell(money(r.balance), 5, y);
    y += rowHeight;
  });
  return doc.output("datauristring").split(",")[1] ?? "";
}
