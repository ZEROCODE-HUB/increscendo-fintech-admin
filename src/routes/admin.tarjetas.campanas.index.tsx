import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { ActionsDropdown } from "@/components/actions-dropdown";
import { Badge } from "@/components/portal-shell";
import { useCampaigns } from "@/hooks/queries";
import { date } from "@/lib/format";
import type { Campaign } from "@/lib/api/types";

export const Route = createFileRoute("/admin/tarjetas/campanas/")({
  component: Campaigns,
});

function Bar({ value, total }: { value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-brand-accent" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums w-14 text-right">
        {value} · {pct}%
      </span>
    </div>
  );
}

function Campaigns() {
  const { data = [], isLoading } = useCampaigns();
  const navigate = useNavigate();
  const cols: Column<Campaign>[] = [
    { key: "name", label: "Campaña", filterable: true, minWidth: 220, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "createdAt", label: "Fecha de envío", sortable: true, minWidth: 110, render: (r) => date(r.createdAt) },
    { key: "recipients", label: "Destinatarios", sortable: true, minWidth: 100, render: (r) => r.recipients },
    { key: "opened", label: "Abrieron", minWidth: 150, render: (r) => <Bar value={r.opened} total={r.recipients} /> },
    { key: "completed", label: "Completaron solicitud", minWidth: 150, render: (r) => <Bar value={r.completed} total={r.recipients} /> },
    { key: "activated", label: "Tarjeta activa", minWidth: 150, render: (r) => <Bar value={r.activated} total={r.recipients} /> },
    { key: "expiresAt", label: "Enlaces vencen", minWidth: 110, render: (r) => date(r.expiresAt) },
    {
      key: "status",
      label: "Estatus",
      minWidth: 90,
      render: (r) => <Badge tone={r.status === "cerrada" ? "neutral" : r.status === "enviando" ? "info" : "success"}>{r.status === "cerrada" ? "Cerrada" : r.status === "enviando" ? "Enviando" : "Activa"}</Badge>,
    },
  ];
  return (
    <DataTable
      columns={cols}
      data={data}
      loading={isLoading}
      keyExtractor={(r) => r.id}
      showDownloadButton={false}
      actions={(r) => (
        <ActionsDropdown
          actions={[
            { label: "Ver destinatarios", icon: Users, onClick: () => navigate({ to: "/admin/tarjetas/campanas/destinatarios", search: { campaign: r.id } }) },
          ]}
        />
      )}
    />
  );
}
