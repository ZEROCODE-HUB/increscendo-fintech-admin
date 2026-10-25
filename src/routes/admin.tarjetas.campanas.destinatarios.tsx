import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { ActionsDropdown } from "@/components/actions-dropdown";
import { Badge } from "@/components/portal-shell";
import { RECIPIENT_LABEL } from "@/components/cards/cards-common";
import { useRecipients, useRefreshAll } from "@/hooks/queries";
import { resendInvitation } from "@/lib/api/cards";
import { date } from "@/lib/format";
import type { CampaignRecipient } from "@/lib/api/types";

export const Route = createFileRoute("/admin/tarjetas/campanas/destinatarios")({
  validateSearch: (s: Record<string, unknown>): { campaign?: string } => (typeof s.campaign === "string" ? { campaign: s.campaign } : {}),
  component: Recipients,
});

type Row = CampaignRecipient & { statusLabel: string };

function Recipients() {
  const { campaign } = Route.useSearch();
  const { data = [], isLoading } = useRecipients(campaign);
  const refresh = useRefreshAll();
  const rows: Row[] = data.map((r) => ({ ...r, statusLabel: RECIPIENT_LABEL[r.status] }));
  const cols: Column<Row>[] = [
    { key: "name", label: "Nombre", filterable: true, minWidth: 180, render: (r) => r.name },
    { key: "email", label: "Correo", filterable: true, minWidth: 200, render: (r) => r.email },
    { key: "campaignName", label: "Campaña", filterable: "enum", filterOptions: Array.from(new Set(rows.map((r) => r.campaignName))), minWidth: 180, render: (r) => r.campaignName },
    {
      key: "statusLabel",
      label: "Avance",
      filterable: "enum",
      filterOptions: Object.values(RECIPIENT_LABEL),
      minWidth: 170,
      render: (r) => (
        <Badge tone={r.status === "activa" ? "success" : r.status === "rechazada" || r.status === "expirada" ? "danger" : r.status === "en_revision" ? "warn" : "info"}>
          {r.statusLabel}
        </Badge>
      ),
    },
    { key: "updatedAt", label: "Última actividad", sortable: true, minWidth: 110, render: (r) => date(r.updatedAt) },
    { key: "tokenExpiresAt", label: "Enlace vence", minWidth: 110, render: (r) => date(r.tokenExpiresAt) },
  ];
  return (
    <DataTable
      columns={cols}
      data={rows}
      loading={isLoading}
      keyExtractor={(r) => r.id}
      actions={(r) => (
        <ActionsDropdown
          actions={[
            {
              label: "Reenviar invitación",
              icon: Send,
              disabled: r.status === "activa",
              hint: "Ya activó su tarjeta.",
              onClick: async () => {
                await resendInvitation(r);
                toast.success("Invitación reenviada con un enlace nuevo (30 días).");
                await refresh();
              },
            },
          ]}
        />
      )}
    />
  );
}
