import { createFileRoute } from "@tanstack/react-router";
import { DataTable, type Column } from "@/components/data-table";
import { Badge } from "@/components/portal-shell";
import { CardStatusBadge, ClientLink } from "@/components/ui-kit";
import { CardsPage } from "@/components/cards/cards-common";
import { CardActions } from "@/components/cards/card-actions";
import { useCards } from "@/hooks/queries";
import { date, money } from "@/lib/format";
import type { Card } from "@/lib/api/types";

export const Route = createFileRoute("/admin/tarjetas/reportadas")({
  head: () => ({ meta: [{ title: "Tarjetas reportadas — Increscendo Fintech" }] }),
  component: Reportadas,
});

function Reportadas() {
  const { data = [], isLoading } = useCards();
  const rows = data.filter((c) => c.status === "reportada" || c.status === "reemplazada");
  const cols: Column<Card>[] = [
    { key: "clientName", label: "Cliente", filterable: true, minWidth: 190, render: (r) => <ClientLink id={r.userId} name={r.clientName} /> },
    { key: "lastDigits", label: "Tarjeta", minWidth: 100, render: (r) => <span className="font-mono">•••• {r.lastDigits}</span> },
    { key: "reportReason", label: "Motivo", minWidth: 100, render: (r) => (r.reportReason ? <Badge tone="danger">{r.reportReason === "robo" ? "Robo" : "Extravío"}</Badge> : "—") },
    { key: "reportedAt", label: "Fecha de reporte", sortable: true, minWidth: 110, render: (r) => date(r.reportedAt) },
    { key: "balance", label: "Saldo a transferir", minWidth: 120, render: (r) => money(r.balance) },
    { key: "status", label: "Estatus", minWidth: 120, render: (r) => <CardStatusBadge status={r.status} /> },
  ];
  return (
    <CardsPage title="Tarjetas reportadas" description="Tarjetas perdidas o robadas, pendientes de reemplazo de plástico." service="Bloquear / desbloquear, Reemplazo de plástico">
      <DataTable columns={cols} data={rows} loading={isLoading} keyExtractor={(r) => r.id} actions={(r) => <CardActions card={r} />} emptyMessage="No hay tarjetas reportadas." />
    </CardsPage>
  );
}
