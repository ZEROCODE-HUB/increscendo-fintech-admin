import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Ban, CheckCircle2, Eye, History, PackageCheck, Plus, RefreshCcw, ShieldAlert } from "lucide-react";
import { ActionsDropdown } from "@/components/actions-dropdown";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormDialog } from "@/components/form-dialog";
import { ModalDialog } from "@/components/modal-dialog";
import { Input } from "@/components/portal-shell";
import { FieldLabel, Select, Spinner } from "@/components/ui-kit";
import { useCardMovements, useMasterAccount, useRefreshAll } from "@/hooks/queries";
import { markCardDelivered, rechargeCard, replaceCard, reportCard, toggleCardBlock } from "@/lib/api/cards";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { dateTime, money } from "@/lib/format";
import type { Card } from "@/lib/api/types";

export function CardActions({ card }: { card: Card }) {
  const navigate = useNavigate();
  const refresh = useRefreshAll();
  const { profile } = useAuth();
  const mayBalance = can(profile?.role, "tarjetas.saldo", "editar");
  const mayEdit = can(profile?.role, "tarjetas", "editar");
  const [open, setOpen] = useState<null | "recharge" | "block" | "movs" | "report" | "replace">(null);
  const close = () => setOpen(null);
  const noPerm = "Tu rol no tiene permiso para esta acción.";
  return (
    <>
      <ActionsDropdown
        actions={[
          { label: "Ver cliente", icon: Eye, onClick: () => navigate({ to: "/admin/general/usuarios/$id", params: { id: card.userId }, search: { tab: "productos" } }) },
          { label: "Ver movimientos", icon: History, onClick: () => setOpen("movs") },
          { label: "Marcar como entregada", icon: PackageCheck, hidden: card.status !== "pendiente_entrega", disabled: !mayEdit, hint: noPerm, onClick: async () => { await markCardDelivered(card); toast.success("Tarjeta entregada y activa."); await refresh(); } },
          { label: "Recargar saldo", icon: Plus, divider: true, hidden: !["activa", "bloqueo_temporal"].includes(card.status), disabled: !mayBalance, hint: noPerm, onClick: () => setOpen("recharge") },
          {
            label: card.status === "bloqueada" ? "Desbloquear" : "Bloquear",
            icon: card.status === "bloqueada" ? CheckCircle2 : Ban,
            hidden: !["activa", "bloqueada"].includes(card.status),
            disabled: !mayEdit,
            hint: noPerm,
            onClick: () => setOpen("block"),
          },
          { label: "Reportar robo o extravío", icon: ShieldAlert, variant: "danger", hidden: !["activa", "bloqueada", "bloqueo_temporal"].includes(card.status), disabled: !mayEdit, hint: noPerm, onClick: () => setOpen("report") },
          { label: "Reemplazar plástico", icon: RefreshCcw, hidden: card.status !== "reportada", disabled: !mayEdit, hint: noPerm, onClick: () => setOpen("replace") },
        ]}
      />
      {open === "recharge" && <RechargeDialog card={card} onClose={close} />}
      <ConfirmDialog
        open={open === "block"}
        onClose={close}
        title={card.status === "bloqueada" ? "Desbloquear tarjeta" : "Bloquear tarjeta"}
        message={`Tarjeta •••• ${card.lastDigits} de ${card.clientName}. ${card.status === "bloqueada" ? "Podrá volver a usarla." : "No podrá hacer compras ni retiros hasta desbloquearla."}`}
        variant={card.status === "bloqueada" ? "default" : "danger"}
        confirmLabel={card.status === "bloqueada" ? "Desbloquear" : "Bloquear"}
        onConfirm={async () => {
          await toggleCardBlock(card);
          toast.success(card.status === "bloqueada" ? "Tarjeta desbloqueada." : "Tarjeta bloqueada.");
          close();
          await refresh();
        }}
      />
      {open === "report" && <ReportDialog card={card} onClose={close} />}
      <ConfirmDialog
        open={open === "replace"}
        onClose={close}
        title="Reemplazar plástico"
        message={`Se asignará una tarjeta física nueva a ${card.clientName} y se transferirá el saldo (${money(card.balance)}). La tarjeta •••• ${card.lastDigits} queda cancelada.`}
        confirmLabel="Reemplazar"
        onConfirm={async () => {
          await replaceCard(card);
          toast.success("Plástico reemplazado. La nueva tarjeta queda por entregar.");
          close();
          await refresh();
        }}
      />
      {open === "movs" && <MovementsDialog card={card} onClose={close} />}
    </>
  );
}

function RechargeDialog({ card, onClose }: { card: Card; onClose: () => void }) {
  const { data: master } = useMasterAccount();
  const refresh = useRefreshAll();
  const [amount, setAmount] = useState("500");
  const [busy, setBusy] = useState(false);
  return (
    <FormDialog
      open
      onClose={onClose}
      title="Recargar saldo"
      description={`•••• ${card.lastDigits} · ${card.clientName} · saldo actual ${money(card.balance)}`}
      submitLabel="Recargar"
      isSubmitting={busy}
      onSubmit={async () => {
        setBusy(true);
        try {
          await rechargeCard(card, Number(amount));
          toast.success("Saldo cargado desde la Cuenta Maestra.");
          onClose();
          await refresh();
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <FieldLabel>Monto (MXN)</FieldLabel>
        <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <p className="text-xs text-muted-foreground mt-1">Disponible en Cuenta Maestra: {money(master?.balance)}</p>
      </div>
    </FormDialog>
  );
}

function ReportDialog({ card, onClose }: { card: Card; onClose: () => void }) {
  const refresh = useRefreshAll();
  const [reason, setReason] = useState<"robo" | "extravio">("extravio");
  const [busy, setBusy] = useState(false);
  return (
    <FormDialog
      open
      onClose={onClose}
      title="Reportar tarjeta"
      description={`•••• ${card.lastDigits} · ${card.clientName}`}
      submitLabel="Reportar y bloquear"
      isSubmitting={busy}
      onSubmit={async () => {
        setBusy(true);
        try {
          await reportCard(card, reason);
          toast.success("Tarjeta reportada. Pasa a Reportadas para su reemplazo.");
          onClose();
          await refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      <FieldLabel>Motivo</FieldLabel>
      <Select value={reason} onChange={(e) => setReason(e.target.value as "robo" | "extravio")}>
        <option value="extravio">Extravío</option>
        <option value="robo">Robo</option>
      </Select>
    </FormDialog>
  );
}

function MovementsDialog({ card, onClose }: { card: Card; onClose: () => void }) {
  const { data = [], isLoading } = useCardMovements(card.id);
  return (
    <ModalDialog open onClose={onClose} title={`Movimientos · •••• ${card.lastDigits}`} description={card.clientName} size="lg">
      {isLoading ? (
        <div className="py-10 flex justify-center text-muted-foreground">
          <Spinner />
        </div>
      ) : (
        <ul className="divide-y">
          {data.map((m) => (
            <li key={m.id} className="flex justify-between py-2 text-sm">
              <span>
                {m.description}
                <span className="block text-xs text-muted-foreground">{dateTime(m.date)}</span>
              </span>
              <span className={`tabular-nums ${m.amount < 0 ? "" : "text-emerald-700"}`}>{money(m.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </ModalDialog>
  );
}
