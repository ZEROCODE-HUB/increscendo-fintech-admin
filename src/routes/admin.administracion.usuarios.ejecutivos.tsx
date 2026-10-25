import { createFileRoute } from "@tanstack/react-router";
import { DataTable, type Column } from "@/components/data-table";
import { InfoNote } from "@/components/ui-kit";
import { useBackofficeUsers, useClients } from "@/hooks/queries";
import { summarizeExecutives, type ExecutiveSummary } from "@/lib/api/backoffice";

export const Route = createFileRoute("/admin/administracion/usuarios/ejecutivos")({
  component: Ejecutivos,
});

function Ejecutivos() {
  const { data: users = [] } = useBackofficeUsers();
  const { data: clients = [], isLoading } = useClients();
  const rows = summarizeExecutives(users, clients);
  const direct = clients.filter((c) => !c.executiveId).length;
  const cols: Column<ExecutiveSummary>[] = [
    { key: "name", label: "Ejecutivo", filterable: true, minWidth: 180, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "location", label: "Plaza", minWidth: 100, render: (r) => r.location ?? "—" },
    { key: "clients", label: "Clientes", sortable: true, minWidth: 90, render: (r) => r.clients },
    { key: "last30", label: "Altas 30 días", sortable: true, minWidth: 100, render: (r) => r.last30 },
    { key: "withMembership", label: "Con membresía activa", sortable: true, minWidth: 140, render: (r) => r.withMembership },
    { key: "withLoan", label: "Con préstamo", sortable: true, minWidth: 110, render: (r) => r.withLoan },
  ];
  return (
    <div className="space-y-3">
      <InfoNote>
        Atribución de cada cliente al ejecutivo que lo dio de alta (resuelve disputas como “ese cliente yo te lo di”). {direct} clientes son de
        registro directo. El cálculo de comisiones puede reutilizar el módulo de comisiones configurables cuando se defina el esquema.
      </InfoNote>
      <DataTable columns={cols} data={rows} loading={isLoading} keyExtractor={(r) => r.id} />
    </div>
  );
}
