import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { CollectionTable } from "@/components/loans/loans-table";
import { DataTable, type Column } from "@/components/data-table";
import { ClientLink, SectionCard } from "@/components/ui-kit";
import { useMovements } from "@/hooks/queries";
import { dateTime, money } from "@/lib/format";
import { failedReasonLabel } from "@/lib/loans/status";
import { MOVEMENT_TYPE_LABEL, PROVIDER_LABEL } from "@/lib/api/movements";
import type { Movement } from "@/lib/api/types";

export const Route = createFileRoute("/admin/prestamos/cobranza/fallidos")({
  component: Fallidos,
});

function Fallidos() {
  const { data = [], isLoading } = useMovements();
  const failed = useMemo(
    () => data.filter((m) => m.product === "prestamo" && m.status === "fallido" && Date.now() - new Date(m.date).getTime() < 30 * 86_400_000),
    [data],
  );
  const loanIds = useMemo(() => new Set(failed.map((m) => m.relatedId).filter(Boolean) as string[]), [failed]);
  const cols: Column<Movement & { reason: string }>[] = [
    { key: "date", label: "Fecha", sortable: true, filterable: "date", minWidth: 120, render: (r) => dateTime(r.date) },
    { key: "clientName", label: "Cliente", filterable: true, minWidth: 180, render: (r) => <ClientLink id={r.userId} name={r.clientName} /> },
    { key: "description", label: "Detalle", minWidth: 200, render: (r) => r.description },
    { key: "type", label: "Tipo", minWidth: 140, render: (r) => MOVEMENT_TYPE_LABEL[r.type] },
    { key: "amount", label: "Monto", minWidth: 100, render: (r) => money(r.amount) },
    { key: "reason", label: "Motivo de Belvo/Druo", filterable: "enum", filterOptions: Array.from(new Set(failed.map((f) => failedReasonLabel(f.failedReason) ?? "—"))), minWidth: 180, render: (r) => r.reason },
    { key: "provider", label: "Proveedor", minWidth: 90, render: (r) => PROVIDER_LABEL[r.provider] },
  ];
  return (
    <div className="space-y-4">
      <SectionCard title="Cargos rechazados (30 días)" description="Cada intento fallido con el motivo traducido.">
        <DataTable
          columns={cols}
          data={failed.map((f) => ({ ...f, reason: failedReasonLabel(f.failedReason) ?? "—" }))}
          loading={isLoading}
          keyExtractor={(r) => r.id}
          emptyMessage="Sin cobros fallidos en los últimos 30 días."
          showDownloadButton={false}
        />
      </SectionCard>
      <SectionCard title="Préstamos con cobro fallido" description="Desde aquí puedes avisar o volver a cobrar.">
        <CollectionTable view="fallidos" failedLoanIds={loanIds} />
      </SectionCard>
    </div>
  );
}
