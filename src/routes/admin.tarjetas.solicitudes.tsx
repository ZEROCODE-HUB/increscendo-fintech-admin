import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Eye, RefreshCw, XCircle } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { ActionsDropdown } from "@/components/actions-dropdown";
import { FormDialog } from "@/components/form-dialog";
import { ReasonDialog } from "@/components/reason-dialog";
import { Badge, Input } from "@/components/portal-shell";
import { ClientLink, FieldLabel, InfoNote, KycBadge } from "@/components/ui-kit";
import { CardsPage } from "@/components/cards/cards-common";
import { useCardRequests, useMasterAccount, useRefreshAll } from "@/hooks/queries";
import { approveCardRequest, rejectCardRequest, retryCardRequest } from "@/lib/api/cards";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { date, money } from "@/lib/format";
import { useNavigate } from "@tanstack/react-router";
import type { CardRequest } from "@/lib/api/types";

export const Route = createFileRoute("/admin/tarjetas/solicitudes")({
  head: () => ({ meta: [{ title: "Solicitudes de tarjeta — Increscendo Fintech" }] }),
  component: Solicitudes,
});

function ApproveDialog({ req, onClose }: { req: CardRequest; onClose: () => void }) {
  const [line, setLine] = useState(String(req.creditLine));
  const [busy, setBusy] = useState(false);
  const { data: master } = useMasterAccount();
  const refresh = useRefreshAll();
  const blocked = req.kycStatus !== "verificado";
  return (
    <FormDialog
      open
      onClose={onClose}
      title="Aprobar solicitud de tarjeta"
      description={`${req.clientName} · ${req.membershipName}`}
      submitLabel="Aprobar y dar de alta en OneCard"
      isSubmitting={busy}
      onSubmit={async () => {
        if (blocked) return;
        setBusy(true);
        try {
          await approveCardRequest(req, Number(line));
          toast.success("Tarjeta creada en OneCard. El cliente pasa a Asignación y firma de contrato.");
          onClose();
          await refresh();
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {blocked && <InfoNote>La identidad del cliente no está verificada. Verifícala en su ficha antes de aprobar la tarjeta.</InfoNote>}
      <div>
        <FieldLabel>Saldo inicial a cargar (MXN)</FieldLabel>
        <Input type="number" value={line} onChange={(e) => setLine(e.target.value)} />
        <p className="text-xs text-muted-foreground mt-1">Disponible en Cuenta Maestra: {money(master?.balance)}</p>
      </div>
      <InfoNote>
        Al aprobar se llaman los servicios de OneCard “Alta de tarjeta” y “Carga de saldo”. Después el cliente firma el contrato de la
        tarjeta en su app y se le avisa que puede recogerla.
      </InfoNote>
    </FormDialog>
  );
}

function Solicitudes() {
  const { data = [], isLoading } = useCardRequests();
  const refresh = useRefreshAll();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const mayEdit = can(profile?.role, "tarjetas", "editar");
  const [approving, setApproving] = useState<CardRequest | null>(null);
  const [rejecting, setRejecting] = useState<CardRequest | null>(null);
  const cols: Column<CardRequest>[] = [
    { key: "clientName", label: "Cliente", filterable: true, minWidth: 190, render: (r) => <ClientLink id={r.userId} name={r.clientName} /> },
    { key: "membershipName", label: "Membresía", minWidth: 100, render: (r) => r.membershipName },
    { key: "kycStatus", label: "Identidad", minWidth: 110, render: (r) => <KycBadge status={r.kycStatus} /> },
    { key: "campaignName", label: "Origen", minWidth: 180, render: (r) => r.campaignName ?? "Solicitud directa" },
    { key: "creditLine", label: "Saldo propuesto", minWidth: 110, render: (r) => money(r.creditLine) },
    { key: "requestedAt", label: "Fecha de solicitud", sortable: true, minWidth: 110, render: (r) => date(r.requestedAt) },
    {
      key: "status",
      label: "Estatus",
      minWidth: 140,
      render: (r) => (r.status === "error_onecard" ? <Badge tone="danger" title={r.errorMessage ?? ""}>Error de OneCard</Badge> : <Badge tone="warn">Por revisar</Badge>),
    },
  ];
  return (
    <CardsPage title="Solicitudes" description="Solicitudes por revisar: aprobar, rechazar o reintentar." service="Alta de tarjeta, Carga de saldo">
      <DataTable
        columns={cols}
        data={data}
        loading={isLoading}
        keyExtractor={(r) => r.id}
        emptyMessage="No hay solicitudes por revisar."
        actions={(r) => (
          <ActionsDropdown
            actions={[
              { label: "Ver cliente", icon: Eye, onClick: () => navigate({ to: "/admin/general/usuarios/$id", params: { id: r.userId }, search: { tab: "documentos" } }) },
              { label: "Aprobar", icon: CheckCircle2, divider: true, hidden: r.status === "error_onecard", disabled: !mayEdit, hint: "Sin permiso", onClick: () => setApproving(r) },
              {
                label: "Reintentar alta en OneCard",
                icon: RefreshCw,
                hidden: r.status !== "error_onecard",
                disabled: !mayEdit,
                hint: "Sin permiso",
                onClick: async () => {
                  await retryCardRequest(r);
                  toast.success("Reintento enviado.");
                  await refresh();
                },
              },
              { label: "Rechazar con motivo", icon: XCircle, variant: "danger", disabled: !mayEdit, hint: "Sin permiso", onClick: () => setRejecting(r) },
            ]}
          />
        )}
      />
      {approving && <ApproveDialog req={approving} onClose={() => setApproving(null)} />}
      <ReasonDialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Rechazar solicitud de tarjeta"
        description={rejecting?.clientName}
        appliesTo="tarjeta"
        onConfirm={async (code) => {
          if (!rejecting) return;
          await rejectCardRequest(rejecting, code);
          toast.success("Solicitud rechazada. El cliente recibe el motivo.");
          setRejecting(null);
          await refresh();
        }}
      />
    </CardsPage>
  );
}
