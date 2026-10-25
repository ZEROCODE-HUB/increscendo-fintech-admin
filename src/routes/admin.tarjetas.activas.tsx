import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { CardStatusBadge, ClientLink, CARD_STATUS_LABEL } from "@/components/ui-kit";
import { CardsPage } from "@/components/cards/cards-common";
import { CardActions } from "@/components/cards/card-actions";
import { useCards } from "@/hooks/queries";
import { date, money } from "@/lib/format";
import type { Card } from "@/lib/api/types";

export const Route = createFileRoute("/admin/tarjetas/activas")({
  head: () => ({ meta: [{ title: "Tarjetas activas — Increscendo Fintech" }] }),
  component: Activas,
});

type Row = Card & { statusLabel: string; kindLabel: string };

function Activas() {
  const { data = [], isLoading } = useCards();
  const rows: Row[] = useMemo(
    () =>
      data
        .filter((c) => ["activa", "bloqueada", "bloqueo_temporal", "pendiente_entrega"].includes(c.status))
        .map((c) => ({ ...c, statusLabel: CARD_STATUS_LABEL[c.status], kindLabel: c.kind === "fisica" ? "Física" : "Virtual" })),
    [data],
  );
  const total = rows.reduce((s, r) => s + r.balance, 0);
  const cols: Column<Row>[] = [
    { key: "clientName", label: "Cliente", filterable: true, minWidth: 190, render: (r) => <ClientLink id={r.userId} name={r.clientName} /> },
    { key: "lastDigits", label: "Tarjeta", filterable: true, minWidth: 100, render: (r) => <span className="font-mono">•••• {r.lastDigits}</span> },
    { key: "kindLabel", label: "Tipo", filterable: "enum", filterOptions: ["Física", "Virtual"], minWidth: 80, render: (r) => r.kindLabel },
    { key: "statusLabel", label: "Estatus", filterable: "enum", filterOptions: ["Activa", "Bloqueada (admin)", "Bloqueo temporal", "Por entregar"], minWidth: 130, render: (r) => <CardStatusBadge status={r.status} /> },
    { key: "balance", label: "Saldo", sortable: true, minWidth: 100, render: (r) => <span className="tabular-nums">{money(r.balance)}</span> },
    { key: "creditLine", label: "Saldo inicial", minWidth: 100, render: (r) => money(r.creditLine) },
    { key: "online", label: "Compras en línea", minWidth: 110, render: (r) => (r.onlinePurchases ? "Activadas" : "Desactivadas") },
    { key: "issuedAt", label: "Fecha de emisión", sortable: true, minWidth: 100, render: (r) => date(r.issuedAt) },
  ];
  return (
    <CardsPage title="Tarjetas activas" description={`Tarjetas entregadas: recargar saldo, bloquear o desbloquear. Saldo total: ${money(total)}.`} service="Consultar saldo, Carga de saldo, Bloquear / desbloquear">
      <DataTable columns={cols} data={rows} loading={isLoading} keyExtractor={(r) => r.id} actions={(r) => <CardActions card={r} />} />
    </CardsPage>
  );
}
