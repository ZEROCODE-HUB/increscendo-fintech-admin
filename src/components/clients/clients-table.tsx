import { useMemo } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { Badge } from "@/components/portal-shell";
import { ClientLink, KycBadge, KYC_LABEL, SUBSCRIPTION_LABEL } from "@/components/ui-kit";
import { ClientActions } from "./client-dialogs";
import { useClients } from "@/hooks/queries";
import { useAuth } from "@/lib/auth";
import { date } from "@/lib/format";
import type { Client } from "@/lib/api/types";

type Row = Client & { kycLabel: string; membershipLabel: string; planLabel: string; execLabel: string };

export function ClientsTable({ filter }: { filter: "fisica" | "moral" | "por_verificar" }) {
  const { data = [], isLoading } = useClients();
  const { profile } = useAuth();
  const rows: Row[] = useMemo(
    () =>
      data
        .filter((c) => (filter === "por_verificar" ? c.kyc.status === "por_verificar" : c.personType === filter))
        // Un agente comercial solo ve los clientes que él dio de alta.
        .filter((c) => profile?.role !== "agente" || c.executiveId === profile.id)
        .map((c) => ({
          ...c,
          kycLabel: KYC_LABEL[c.kyc.status],
          membershipLabel: c.membership ? SUBSCRIPTION_LABEL[c.membership.status] : "Sin membresía",
          planLabel: c.membership?.planName ?? "—",
          execLabel: c.executiveName ?? "Registro directo",
        })),
    [data, filter, profile],
  );
  const plans = Array.from(new Set(rows.map((r) => r.planLabel))).sort();
  const execs = Array.from(new Set(rows.map((r) => r.execLabel))).sort();

  const cols: Column<Row>[] = [
    { key: "code", label: "Código", sortable: true, filterable: true, minWidth: 90, render: (r) => <span className="font-mono text-xs">{r.code || "—"}</span> },
    { key: "fullName", label: filter === "moral" ? "Razón social" : "Nombre", sortable: true, filterable: true, minWidth: 200, maxWidth: 280, render: (r) => <ClientLink id={r.id} name={r.fullName} /> },
    { key: "email", label: "Correo", filterable: true, minWidth: 200, maxWidth: 260, render: (r) => r.email },
    { key: "rfc", label: "RFC", filterable: true, minWidth: 130, render: (r) => <span className="font-mono text-xs">{r.rfc || "—"}</span> },
    {
      key: "kycLabel",
      label: "Identidad",
      filterable: "enum",
      filterOptions: Object.values(KYC_LABEL),
      minWidth: 110,
      render: (r) => <KycBadge status={r.kyc.status} />,
    },
    { key: "planLabel", label: "Plan", filterable: "enum", filterOptions: plans, minWidth: 100, render: (r) => r.planLabel },
    {
      key: "membershipLabel",
      label: "Membresía",
      filterable: "enum",
      filterOptions: ["Activa", "Pago pendiente", "Vencida", "Cancelada", "Sin membresía"],
      minWidth: 120,
      render: (r) =>
        r.membership ? (
          <Badge tone={r.membership.status === "active" ? "success" : r.membership.status === "pending" ? "warn" : "neutral"}>{r.membershipLabel}</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">Sin membresía</span>
        ),
    },
    { key: "loans", label: "Préstamos", minWidth: 90, render: (r) => (r.loansTotal ? `${r.loansActive} activos / ${r.loansTotal}` : r.loanEligible ? "Invitado" : "—") },
    { key: "execLabel", label: "Ejecutivo", filterable: "enum", filterOptions: execs, minWidth: 140, render: (r) => r.execLabel },
    { key: "createdAt", label: "Fecha de alta", sortable: true, filterable: "date", minWidth: 110, render: (r) => date(r.createdAt) },
  ];

  return (
    <DataTable
      columns={cols}
      data={rows}
      loading={isLoading}
      keyExtractor={(r) => r.id}
      actions={(r) => <ClientActions client={r} />}
      emptyMessage={filter === "por_verificar" ? "No hay identidades por verificar." : "No hay clientes."}
      downloadExcel={async (d) => {
        const XLSX = await import("xlsx");
        const ws = XLSX.utils.json_to_sheet(
          d.map((r) => ({
            Código: r.code,
            Nombre: r.fullName,
            Tipo: r.personType === "moral" ? "Persona moral" : "Persona física",
            Correo: r.email,
            Teléfono: r.phone,
            RFC: r.rfc,
            CURP: r.curp,
            Identidad: r.kycLabel,
            Plan: r.planLabel,
            Membresía: r.membershipLabel,
            "Préstamos activos": r.loansActive,
            Ejecutivo: r.execLabel,
            Alta: date(r.createdAt),
            Domicilio: r.address,
          })),
        );
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Clientes");
        XLSX.writeFile(wb, `clientes-${filter}-${new Date().toISOString().slice(0, 10)}.xlsx`);
      }}
    />
  );
}
