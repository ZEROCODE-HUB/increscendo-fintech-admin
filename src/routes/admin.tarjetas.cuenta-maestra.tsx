import { createFileRoute } from "@tanstack/react-router";
import { DataTable, type Column } from "@/components/data-table";
import { KpiCard } from "@/components/kpi-card";
import { CardsPage } from "@/components/cards/cards-common";
import { useMasterAccount, useMasterMovements } from "@/hooks/queries";
import { dateTime, money } from "@/lib/format";
import type { MasterMovement } from "@/lib/api/types";

export const Route = createFileRoute("/admin/tarjetas/cuenta-maestra")({
  head: () => ({ meta: [{ title: "Cuenta Maestra — Increscendo Fintech" }] }),
  component: Master,
});

const KIND: Record<MasterMovement["kind"], string> = { carga_inicial: "Carga inicial", recarga: "Recarga", fondeo: "Fondeo", ajuste: "Ajuste" };

function Master() {
  const { data: m } = useMasterAccount();
  const { data = [], isLoading } = useMasterMovements();
  const rows = data.map((r) => ({ ...r, kindLabel: KIND[r.kind] }));
  const cols: Column<(typeof rows)[number]>[] = [
    { key: "date", label: "Fecha", sortable: true, filterable: "date", minWidth: 130, render: (r) => dateTime(r.date) },
    { key: "kindLabel", label: "Tipo", filterable: "enum", filterOptions: Object.values(KIND), minWidth: 110, render: (r) => r.kindLabel },
    { key: "clientName", label: "Cliente", filterable: true, minWidth: 180, render: (r) => r.clientName },
    { key: "cardLast", label: "Tarjeta", minWidth: 90, render: (r) => (r.cardLast === "—" ? "—" : `•••• ${r.cardLast}`) },
    { key: "amount", label: "Monto", sortable: true, minWidth: 110, render: (r) => <span className={`tabular-nums ${r.amount < 0 ? "text-red-600" : "text-emerald-700"}`}>{money(r.amount)}</span> },
    { key: "by", label: "Realizó", minWidth: 120, render: (r) => r.by },
  ];
  return (
    <CardsPage title="Cuenta Maestra" description="Saldo y movimientos del fondo general del convenio con OneCard." recurso="tarjetas.saldo" service="Saldo y Movimientos de la Cuenta Maestra">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Saldo disponible" value={money(m?.balance)} sub="para repartir entre clientes" />
        <KpiCard label="Asignado hoy" value={money(m?.assignedToday)} />
        <KpiCard label="Asignado en el mes" value={money(m?.assignedMonth)} />
        <KpiCard label="Última consulta" value={m ? dateTime(m.lastSyncAt) : "—"} />
      </div>
      <DataTable columns={cols} data={rows} loading={isLoading} keyExtractor={(r) => r.id} dateFilterColumns={["date"]} />
    </CardsPage>
  );
}
