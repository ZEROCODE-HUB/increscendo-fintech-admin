import { useMemo } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { Badge } from "@/components/portal-shell";
import { ClientLink, KycBadge } from "@/components/ui-kit";
import { LoanActions } from "./loan-actions";
import { useClients, useLoans } from "@/hooks/queries";
import { date, daysBetween, maskClabe, money } from "@/lib/format";
import { bankName, providerForBank } from "@/lib/api/catalogs-data";
import { STAGE_LABEL, agingBucket, loanStatusLabel } from "@/lib/loans/status";
import type { KycStatus, Loan, LoanStage } from "@/lib/api/types";

type Row = Loan & {
  kyc: KycStatus | null;
  statusLabel: string;
  stageLabel: string;
  providerLabel: string;
  bucketLabel: string;
};

const BUCKET_LABEL: Record<string, string> = { al_dia: "Al día", "1-7": "1–7 días", "8-30": "8–30 días", "31-60": "31–60 días", "60+": "Más de 60" };

function toRow(l: Loan, kyc: KycStatus | null): Row {
  return {
    ...l,
    kyc,
    statusLabel: loanStatusLabel(l).label.replace(/ \d+ d$/, ""),
    stageLabel: STAGE_LABEL[l.stage],
    providerLabel: providerForBank(l.bank) === "druo" ? "Druo" : "Belvo",
    bucketLabel: BUCKET_LABEL[agingBucket(l.daysOverdue)],
  };
}

const folio: Column<Row> = { key: "folio", label: "Folio", sortable: true, filterable: true, minWidth: 100, render: (r) => <span className="font-mono text-xs">{r.folio}</span> };
const cliente: Column<Row> = { key: "clientName", label: "Cliente", sortable: true, filterable: true, minWidth: 190, maxWidth: 260, render: (r) => <ClientLink id={r.userId} name={r.clientName} /> };
const monto: Column<Row> = { key: "amount", label: "Monto", sortable: true, minWidth: 110, render: (r) => <span className="tabular-nums">{money(r.amount)}</span> };
const cuotas: Column<Row> = { key: "installments", label: "Cuotas", minWidth: 80, render: (r) => r.installments };
const membresia: Column<Row> = { key: "membershipName", label: "Membresía", filterable: "enum", filterOptions: [], minWidth: 120, render: (r) => r.membershipName };
const estatus: Column<Row> = {
  key: "statusLabel",
  label: "Estatus",
  minWidth: 130,
  filterable: "enum",
  filterOptions: ["Pendiente", "En revisión", "Firma pendiente", "Firmado", "Desembolsado", "Al día", "Atrasado", "Liquidado", "Rechazado", "Cartera vendida"],
  render: (r) => {
    const s = loanStatusLabel(r);
    return <Badge tone={s.tone}>{s.label}</Badge>;
  },
};
const proveedor: Column<Row> = {
  key: "providerLabel",
  label: "Cobro por",
  minWidth: 90,
  filterable: "enum",
  filterOptions: ["Belvo", "Druo"],
  render: (r) => r.providerLabel,
};

function columnsFor(stage: LoanStage | "todos"): Column<Row>[] {
  switch (stage) {
    case "solicitud":
      return [
        folio, cliente, monto, cuotas, membresia,
        { key: "kyc", label: "Identidad", minWidth: 110, render: (r) => (r.kyc ? <KycBadge status={r.kyc} /> : "—") },
        {
          key: "consent",
          label: "Consentimiento",
          minWidth: 120,
          render: (r) => <Badge tone={r.consentStatus === "confirmed" ? "success" : "warn"}>{r.consentStatus === "confirmed" ? "Confirmado" : "Pendiente"}</Badge>,
        },
        { key: "appliedAt", label: "Fecha de solicitud", sortable: true, filterable: "date", minWidth: 120, render: (r) => date(r.appliedAt) },
      ];
    case "firma":
      return [
        folio, cliente, monto, cuotas,
        {
          key: "signature",
          label: "Firma",
          minWidth: 110,
          render: (r) => <Badge tone={r.signatureStatus === "Error" ? "danger" : "warn"}>{r.signatureStatus === "Error" ? "Error al enviar" : "En espera"}</Badge>,
        },
        { key: "approvedAt", label: "Fecha de aprobación", sortable: true, filterable: "date", minWidth: 120, render: (r) => date(r.approvedAt) },
        { key: "waiting", label: "Días esperando", minWidth: 100, render: (r) => (r.approvedAt ? daysBetween(new Date(r.approvedAt), new Date()) : "—") },
      ];
    case "desembolso":
      return [
        folio, cliente, monto,
        { key: "bank", label: "Banco", minWidth: 140, render: (r) => bankName(r.bank) },
        { key: "clabe", label: "CLABE", minWidth: 110, render: (r) => <span className="font-mono text-xs">{maskClabe(r.clabe)}</span> },
        proveedor,
        { key: "signedAt", label: "Fecha de firma", sortable: true, filterable: "date", minWidth: 110, render: (r) => date(r.signedAt) },
      ];
    case "activo":
      return [
        folio, cliente, monto,
        { key: "progress", label: "Pagadas", minWidth: 90, render: (r) => `${r.paidInstallments}/${r.installments}` },
        { key: "nextPaymentDate", label: "Próximo pago", sortable: true, filterable: "date", minWidth: 110, render: (r) => date(r.nextPaymentDate) },
        estatus,
        proveedor,
      ];
    case "cerrado":
      return [
        folio, cliente, monto,
        { key: "progress", label: "Pagadas", minWidth: 90, render: (r) => `${r.paidInstallments}/${r.installments}` },
        estatus,
        { key: "reason", label: "Motivo / nota", minWidth: 180, maxWidth: 260, render: (r) => r.rejection?.code ?? (r.portfolioSold ? "Venta de cartera" : "—") },
        { key: "appliedAt", label: "Fecha de solicitud", sortable: true, filterable: "date", minWidth: 110, render: (r) => date(r.appliedAt) },
      ];
    default:
      return [
        folio, cliente, monto, cuotas,
        {
          key: "stageLabel",
          label: "Etapa",
          minWidth: 120,
          filterable: "enum",
          filterOptions: Object.values(STAGE_LABEL),
          render: (r) => r.stageLabel,
        },
        estatus, membresia,
        { key: "appliedAt", label: "Fecha de solicitud", sortable: true, filterable: "date", minWidth: 110, render: (r) => date(r.appliedAt) },
      ];
  }
}

export function LoansTable({ stage }: { stage: LoanStage | "todos" }) {
  const { data: loans = [], isLoading } = useLoans();
  const { data: clients = [] } = useClients();
  const kycById = useMemo(() => new Map(clients.map((c) => [c.id, c.kyc.status])), [clients]);
  const rows: Row[] = useMemo(
    () =>
      loans
        .filter((l) => stage === "todos" || l.stage === stage)
        .map((l) => toRow(l, kycById.get(l.userId) ?? null)),
    [loans, stage, kycById],
  );
  const cols = useMemo(() => {
    const c = columnsFor(stage);
    const memberships = Array.from(new Set(rows.map((r) => r.membershipName))).sort();
    return c.map((col) => (col.key === "membershipName" ? { ...col, filterOptions: memberships } : col));
  }, [stage, rows]);

  return (
    <DataTable
      columns={cols}
      data={rows}
      loading={isLoading}
      keyExtractor={(r) => r.id}
      actions={(r) => <LoanActions loan={r} />}
      emptyMessage="No hay préstamos en esta etapa."
      downloadExcel={async (data) => {
        const XLSX = await import("xlsx");
        const ws = XLSX.utils.json_to_sheet(
          data.map((r) => ({
            Folio: r.folio,
            Cliente: r.clientName,
            Correo: r.email,
            Monto: r.amount,
            Cuotas: r.installments,
            Pagadas: r.paidInstallments,
            Etapa: STAGE_LABEL[r.stage],
            Estatus: loanStatusLabel(r).label,
            "Próximo pago": date(r.nextPaymentDate),
            "Días de atraso": r.daysOverdue,
            Banco: bankName(r.bank),
            "Cobro por": providerForBank(r.bank) === "druo" ? "Druo" : "Belvo",
          })),
        );
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Préstamos");
        XLSX.writeFile(wb, `prestamos-${stage}-${new Date().toISOString().slice(0, 10)}.xlsx`);
      }}
    />
  );
}

/* ───────────── Cobranza ───────────── */

export type CollectionView = "atrasados" | "proximos" | "fallidos";

export function CollectionTable({ view, failedLoanIds }: { view: CollectionView; failedLoanIds?: Set<string> }) {
  const { data: loans = [], isLoading } = useLoans();
  const rows: Row[] = useMemo(() => {
    const active = loans.filter((l) => l.stage === "activo" && !l.portfolioSold);
    let r: Loan[];
    if (view === "atrasados") r = active.filter((l) => l.daysOverdue > 0).sort((a, b) => b.daysOverdue - a.daysOverdue);
    else if (view === "proximos")
      r = active
        .filter((l) => l.daysOverdue === 0 && l.nextPaymentDate && new Date(l.nextPaymentDate).getTime() - Date.now() < 15 * 86_400_000)
        .sort((a, b) => String(a.nextPaymentDate).localeCompare(String(b.nextPaymentDate)));
    else r = active.filter((l) => failedLoanIds?.has(l.id));
    return r.map((l) => toRow(l, null));
  }, [loans, view, failedLoanIds]);

  const cols: Column<Row>[] = [
    folio,
    cliente,
    { key: "cuota", label: "Cuota", minWidth: 90, render: (r) => `${Math.min(r.paidInstallments + 1, r.installments)} de ${r.installments}` },
    { key: "monthlyPayment", label: "Monto cuota", minWidth: 110, render: (r) => <span className="tabular-nums">{money(r.monthlyPayment)}</span> },
    { key: "nextPaymentDate", label: view === "proximos" ? "Fecha de cobro" : "Vencimiento", sortable: true, filterable: "date", minWidth: 110, render: (r) => date(r.nextPaymentDate) },
    ...(view === "proximos"
      ? [{ key: "in", label: "Faltan", minWidth: 80, render: (r: Row) => `${Math.max(0, daysBetween(new Date(), new Date(r.nextPaymentDate ?? Date.now())))} d` }]
      : [
          { key: "daysOverdue", label: "Días de atraso", sortable: true, minWidth: 100, render: (r: Row) => <span className={r.daysOverdue > 30 ? "text-red-600 font-semibold" : ""}>{r.daysOverdue}</span> },
          {
            key: "bucketLabel",
            label: "Tramo",
            minWidth: 100,
            filterable: "enum" as const,
            filterOptions: ["1–7 días", "8–30 días", "31–60 días", "Más de 60"],
            render: (r: Row) => r.bucketLabel,
          },
        ]),
    { key: "lastNotice", label: "Último aviso", minWidth: 110, render: (r) => (r.notices[0] ? date(r.notices[0].sentAt) : "Sin aviso") },
    proveedor,
  ];
  return (
    <DataTable
      columns={cols}
      data={rows}
      loading={isLoading}
      keyExtractor={(r) => r.id}
      actions={(r) => <LoanActions loan={r} />}
      emptyMessage={view === "atrasados" ? "No hay cuotas atrasadas." : view === "proximos" ? "No hay cobros en los próximos 15 días." : "No hay cobros fallidos recientes."}
    />
  );
}
