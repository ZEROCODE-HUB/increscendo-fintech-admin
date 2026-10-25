import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { BellRing, Eye, RotateCcw, TimerOff, XCircle } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { ActionsDropdown } from "@/components/actions-dropdown";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ClientLink, SubscriptionBadge, SUBSCRIPTION_LABEL } from "@/components/ui-kit";
import { useRefreshAll, useSubscriptions } from "@/hooks/queries";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { date, money } from "@/lib/format";
import { sendRenewalReminder, setSubscriptionStatus } from "@/lib/api/memberships";
import type { Subscription, SubscriptionStatus } from "@/lib/api/types";

export type SubscriptionView = "todas" | "activas" | "por_vencer" | "vencidas" | "pendientes";

type Row = Subscription & { statusLabel: string; renewLabel: string };

function SubActions({ sub }: { sub: Subscription }) {
  const navigate = useNavigate();
  const refresh = useRefreshAll();
  const { profile } = useAuth();
  const mayEdit = can(profile?.role, "membresias", "editar");
  const [confirm, setConfirm] = useState<SubscriptionStatus | null>(null);
  const noPerm = "Tu rol no tiene permiso para esta acción.";
  const change = async (s: SubscriptionStatus) => {
    try {
      await setSubscriptionStatus(sub, s);
      toast.success("Membresía actualizada.");
      setConfirm(null);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <>
      <ActionsDropdown
        actions={[
          { label: "Ver cliente", icon: Eye, onClick: () => navigate({ to: "/admin/general/usuarios/$id", params: { id: sub.userId }, search: { tab: "productos" } }) },
          {
            label: "Enviar recordatorio de renovación",
            icon: BellRing,
            hidden: sub.status !== "active" && sub.status !== "expired",
            disabled: !mayEdit,
            hint: noPerm,
            onClick: async () => {
              try {
                await sendRenewalReminder(sub);
                toast.success("Recordatorio enviado.");
              } catch (e) {
                toast.error((e as Error).message);
              }
            },
          },
          { label: "Reactivar", icon: RotateCcw, divider: true, hidden: sub.status === "active", disabled: !mayEdit, hint: noPerm, onClick: () => setConfirm("active") },
          { label: "Marcar como vencida", icon: TimerOff, hidden: sub.status !== "active", disabled: !mayEdit, hint: noPerm, onClick: () => setConfirm("expired") },
          { label: "Cancelar membresía", icon: XCircle, variant: "danger", hidden: sub.status === "cancelled", disabled: !mayEdit, hint: noPerm, onClick: () => setConfirm("cancelled") },
        ]}
      />
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm === "active" ? "Reactivar membresía" : confirm === "expired" ? "Marcar como vencida" : "Cancelar membresía"}
        message={`${sub.clientName} · ${sub.planName}. ${confirm === "cancelled" ? "El cliente pierde sus beneficios de inmediato." : ""}`}
        variant={confirm === "cancelled" ? "danger" : "default"}
        confirmLabel="Confirmar"
        onConfirm={() => change(confirm as SubscriptionStatus)}
      />
    </>
  );
}

export function SubscriptionsTable({ view }: { view: SubscriptionView }) {
  const { data = [], isLoading } = useSubscriptions();
  const rows: Row[] = useMemo(() => {
    const f = data.filter((s) => {
      switch (view) {
        case "activas":
          return s.status === "active";
        case "por_vencer":
          return s.status === "active" && s.daysToExpire != null && s.daysToExpire >= 0 && s.daysToExpire <= 30;
        case "vencidas":
          return s.status === "expired";
        case "pendientes":
          return s.status === "pending";
        default:
          return true;
      }
    });
    if (view === "por_vencer") f.sort((a, b) => (a.daysToExpire ?? 0) - (b.daysToExpire ?? 0));
    return f.map((s) => ({ ...s, statusLabel: SUBSCRIPTION_LABEL[s.status], renewLabel: s.autoRenew ? "Automática" : "Manual" }));
  }, [data, view]);
  const plans = Array.from(new Set(rows.map((r) => r.planName))).sort();
  const cols: Column<Row>[] = [
    { key: "clientName", label: "Cliente", sortable: true, filterable: true, minWidth: 190, render: (r) => <ClientLink id={r.userId} name={r.clientName} /> },
    { key: "email", label: "Correo", filterable: true, minWidth: 200, render: (r) => r.email },
    { key: "planName", label: "Plan", filterable: "enum", filterOptions: plans, minWidth: 100, render: (r) => r.planName },
    { key: "price", label: "Precio", sortable: true, minWidth: 90, render: (r) => money(r.price) },
    { key: "statusLabel", label: "Estatus", filterable: "enum", filterOptions: Object.values(SUBSCRIPTION_LABEL), minWidth: 120, render: (r) => <SubscriptionBadge status={r.status} /> },
    { key: "startedAt", label: "Inicio", sortable: true, minWidth: 100, render: (r) => date(r.startedAt) },
    { key: "expiresAt", label: "Fecha de vencimiento", sortable: true, filterable: "date", minWidth: 120, render: (r) => date(r.expiresAt) },
    {
      key: "daysToExpire",
      label: "Días",
      sortable: true,
      minWidth: 70,
      render: (r) =>
        r.daysToExpire == null ? "—" : r.daysToExpire < 0 ? <span className="text-muted-foreground">vencida</span> : <span className={r.daysToExpire <= 7 ? "text-amber-700 font-semibold" : ""}>{r.daysToExpire}</span>,
    },
    { key: "renewLabel", label: "Renovación", filterable: "enum", filterOptions: ["Automática", "Manual"], minWidth: 100, render: (r) => r.renewLabel },
  ];
  return (
    <DataTable
      columns={cols}
      data={rows}
      loading={isLoading}
      keyExtractor={(r) => r.id}
      actions={(r) => <SubActions sub={r} />}
      dateFilterColumns={["expiresAt"]}
      emptyMessage="Sin membresías en esta vista."
    />
  );
}
