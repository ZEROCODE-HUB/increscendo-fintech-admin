import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Banknote,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Eye,
  FileDown,
  FileSignature,
  FileUp,
  HandCoins,
  Landmark,
  PencilLine,
  RefreshCw,
  Send,
  ShieldCheck,
  Tag,
  User,
  XCircle,
} from "lucide-react";
import { ActionsDropdown, type ActionItem } from "@/components/actions-dropdown";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ReasonDialog } from "@/components/reason-dialog";
import { ProcessingOverlay } from "@/components/ui-kit";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { collectionAvailability } from "@/lib/loans/status";
import { money } from "@/lib/format";
import { useClient, useRefreshAll } from "@/hooks/queries";
import * as api from "@/lib/api/loans";
import type { Loan } from "@/lib/api/types";
import {
  AccountDialog,
  ChargeDialog,
  ExternalPaymentDialog,
  FileActionDialog,
  LoanDetailDialog,
  ModifyTermsDialog,
  NoticeDialog,
  ScheduleDialog,
  downloadSchedulePdf,
} from "./loan-dialogs";

type DialogKey =
  | "detail"
  | "schedule"
  | "approve"
  | "reject"
  | "modify"
  | "resend"
  | "reinvite"
  | "attach"
  | "account"
  | "disburse"
  | "notice"
  | "charge"
  | "consent"
  | "sell"
  | "external";

/**
 * Menú ⋯ de préstamos. Mismo componente en todas las pestañas; las acciones
 * dependen de la etapa del préstamo.
 * "Enviar aviso de cobranza" y "Ejecutar cobro" aparecen siempre (pedido de
 * Héctor) y se deshabilitan con explicación cuando no hay cuotas que cobrar.
 */
export function LoanActions({ loan }: { loan: Loan }) {
  const [open, setOpen] = useState<DialogKey | null>(null);
  const [processing, setProcessing] = useState<{ title: string; message: string } | null>(null);
  const navigate = useNavigate();
  const refresh = useRefreshAll();
  const { profile } = useAuth();
  const role = profile?.role;
  const actor = profile?.fullName ?? "Administrador";
  const close = () => setOpen(null);
  const collection = collectionAvailability(loan);
  const mayApprove = can(role, "prestamos.aprobar", "editar");
  const mayCollect = can(role, "prestamos.cobro", "editar");
  const mayDisburse = can(role, "prestamos.desembolso", "editar");
  const noPerm = "Tu rol no tiene permiso para esta acción.";

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      close();
      await refresh();
    } catch (e) {
      toast.error((e as Error).message || "No se pudo completar la acción.");
    }
  };

  const items: ActionItem[] = [
    { label: "Ver detalle", icon: Eye, onClick: () => setOpen("detail") },
    { label: "Ver cronograma", icon: CalendarDays, onClick: () => setOpen("schedule") },
    { label: "Ir al cliente", icon: User, onClick: () => navigate({ to: "/admin/general/usuarios/$id", params: { id: loan.userId } }) },
  ];

  if (loan.stage === "solicitud") {
    items.push(
      { label: "Revisar documentos", icon: ShieldCheck, divider: true, onClick: () => navigate({ to: "/admin/general/usuarios/$id", params: { id: loan.userId }, search: { tab: "documentos" } }) },
      { label: "Aprobar y enviar contrato", icon: CheckCircle2, disabled: !mayApprove, hint: noPerm, onClick: () => setOpen("approve") },
      { label: "Rechazar con motivo", icon: XCircle, variant: "danger", disabled: !mayApprove, hint: noPerm, onClick: () => setOpen("reject") },
      { label: "Modificar términos", icon: PencilLine, disabled: !mayApprove, hint: noPerm, onClick: () => setOpen("modify") },
    );
  }
  if (loan.stage === "firma") {
    items.push(
      { label: "Reenviar contrato (SignNow)", icon: Send, divider: true, onClick: () => setOpen("resend") },
      { label: "Generar nueva invitación", icon: RefreshCw, hidden: loan.signatureStatus !== "Error", onClick: () => setOpen("reinvite") },
      { label: "Subir contrato firmado", icon: FileUp, disabled: !mayApprove, hint: noPerm, onClick: () => setOpen("attach") },
    );
  }
  if (loan.stage === "desembolso") {
    items.push(
      { label: "Cambiar cuenta de desembolso", icon: Landmark, divider: true, disabled: !mayDisburse, hint: noPerm, onClick: () => setOpen("account") },
      { label: "Registrar desembolso", icon: Banknote, disabled: !mayDisburse, hint: noPerm, onClick: () => setOpen("disburse") },
    );
  }

  items.push(
    {
      label: "Enviar aviso de cobranza",
      icon: BellRing,
      divider: true,
      disabled: !collection.enabled || !mayCollect,
      hint: !collection.enabled ? collection.reason : noPerm,
      onClick: () => setOpen("notice"),
    },
    {
      label: "Ejecutar cobro",
      icon: HandCoins,
      disabled: !collection.enabled || !mayCollect,
      hint: !collection.enabled ? collection.reason : noPerm,
      onClick: () => setOpen("charge"),
    },
  );

  if (loan.stage === "activo") {
    items.push(
      { label: "Registrar pago externo", icon: Banknote, disabled: !mayCollect, hint: noPerm, onClick: () => setOpen("external") },
      { label: "Renovar consentimiento", icon: FileSignature, hidden: loan.consentStatus === "confirmed" && loan.daysOverdue === 0, onClick: () => setOpen("consent") },
      { label: "Vender cartera", icon: Tag, variant: "danger", hidden: loan.portfolioSold || loan.daysOverdue < 60, disabled: !mayApprove, hint: noPerm, onClick: () => setOpen("sell") },
    );
  }
  items.push({ label: "Descargar tabla de amortización", icon: FileDown, divider: true, onClick: () => void downloadSchedulePdf(loan) });

  return (
    <>
      <ActionsDropdown actions={items} />

      {open === "detail" && <LoanDetailDialog loan={loan} open onClose={close} />}
      {open === "schedule" && <ScheduleDialog loan={loan} open onClose={close} />}

      <ConfirmDialog
        open={open === "approve"}
        onClose={close}
        title="Aprobar solicitud"
        message={`Se aprobará ${loan.folio} por ${money(loan.amount)} en ${loan.installments} cuotas. Se enviará el contrato por SignNow (con la tabla de amortización) y un correo a ${loan.email}.`}
        confirmLabel="Aprobar"
        onConfirm={async () => {
          close();
          setProcessing({ title: "Aprobando solicitud", message: "Iniciando…" });
          try {
            await api.approveLoan(loan, (m) => setProcessing({ title: "Aprobando solicitud", message: m }));
            toast.success(`${loan.folio} aprobado: contrato enviado para firma.`);
            await refresh();
          } catch (e) {
            toast.error((e as Error).message || "No se pudo aprobar la solicitud.");
          } finally {
            setProcessing(null);
          }
        }}
      />

      <ReasonDialog
        open={open === "reject"}
        onClose={close}
        title="Rechazar solicitud"
        description={`${loan.folio} · ${loan.clientName}`}
        appliesTo="prestamo"
        belvoHint={typeof loan.metadata.belvo_failed_reason === "string" ? (loan.metadata.belvo_failed_reason as string) : null}
        onConfirm={(code, msg) => run(() => api.rejectLoan(loan, code, msg), `${loan.folio} rechazado. El cliente recibió el motivo.`)}
      />

      {open === "modify" && (
        <ModifyTermsDialog loan={loan} open onClose={close} onConfirm={(t) => run(() => api.modifyTerms(loan, t), "Términos actualizados.")} />
      )}

      <ConfirmDialog
        open={open === "resend"}
        onClose={close}
        title="Reenviar contrato"
        message={`Se enviará un recordatorio de firma de SignNow a ${loan.email}.`}
        confirmLabel="Reenviar"
        onConfirm={() => run(() => api.resendContract(loan), "Recordatorio de firma enviado.")}
      />
      <ConfirmDialog
        open={open === "reinvite"}
        onClose={close}
        title="Generar nueva invitación"
        message="La invitación anterior falló. Se generará una nueva en SignNow con la tabla de amortización."
        confirmLabel="Generar"
        onConfirm={() => run(() => api.resendSignatureInvite(loan), "Nueva invitación enviada.")}
      />

      <FileActionDialog
        open={open === "attach"}
        onClose={close}
        title="Subir contrato firmado"
        description="Firma asistida: el cliente firmó en papel y se sube el contrato escaneado. El préstamo pasa a Por desembolsar."
        accept=".pdf,image/*"
        required
        submitLabel="Subir y marcar firmado"
        onConfirm={(file) => run(() => api.attachSignedContract(loan, file as File, profile?.id ?? null), "Contrato adjuntado. Préstamo listo para desembolso.")}
      />

      {open === "account" && (
        <AccountDialog loan={loan} open onClose={close} onConfirm={(b, c) => run(() => api.updateDisbursementAccount(loan, b, c), "Cuenta de desembolso actualizada.")} />
      )}

      <FileActionDialog
        open={open === "disburse"}
        onClose={close}
        title="Registrar desembolso"
        description={`${money(loan.amount)} a ${loan.clientName}. El préstamo pasa a Activo y se notifica al cliente.`}
        accept=".pdf,image/*"
        submitLabel="Confirmar desembolso"
        onConfirm={(file) => run(() => api.confirmDisbursement(loan, file, profile?.id ?? null), "Desembolso registrado. El préstamo está activo.")}
      >
        <p className="text-sm text-muted-foreground">Adjunta el comprobante de la transferencia (opcional).</p>
      </FileActionDialog>

      {open === "notice" && (
        <NoticeDialog
          loan={loan}
          open
          onClose={close}
          onConfirm={(o) => run(() => api.sendCollectionNotice(loan, o, actor), "Aviso de cobranza enviado.")}
        />
      )}
      {open === "charge" && (
        <ChargeDialog
          loan={loan}
          open
          onClose={close}
          onConfirm={(nums) =>
            run(async () => {
              const r = await api.executeCharge(loan, nums);
              if (r.partial) toast.warning(`Se crearon ${r.created} de ${nums.length} cobros.`);
            }, "Cobro enviado. El resultado se verá en Movimientos.")
          }
        />
      )}
      {open === "external" && (
        <ExternalPaymentDialog loan={loan} open onClose={close} onConfirm={(a, r) => run(() => api.registerExternalPayment(loan, a, r), "Pago registrado.")} />
      )}
      {open === "consent" && <ConsentConfirm loan={loan} onClose={close} onDone={refresh} />}

      <FileActionDialog
        open={open === "sell"}
        onClose={close}
        title="Vender cartera"
        description={`${loan.folio} · ${loan.daysOverdue} días de atraso. El préstamo queda cerrado como "Cartera vendida".`}
        accept=".pdf,image/*"
        submitLabel="Registrar venta"
        withComment
        onConfirm={(file, comment) => run(() => api.sellPortfolio(loan, comment, file), "Venta de cartera registrada.")}
      />

      <ProcessingOverlay open={!!processing} title={processing?.title ?? ""} message={processing?.message ?? ""} />
    </>
  );
}

function ConsentConfirm({ loan, onClose, onDone }: { loan: Loan; onClose: () => void; onDone: () => unknown }) {
  const { data: client } = useClient(loan.userId);
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title="Renovar consentimiento"
      message="Se enviará a Belvo una nueva autorización de domiciliación con los documentos vigentes del cliente (INE, selfie y contrato). Si falta alguno, súbelo primero en la ficha del cliente."
      confirmLabel="Renovar"
      onConfirm={async () => {
        try {
          await api.renewConsent(loan, {
            ineFront: client?.documents.ineFrontUrl,
            ineBack: client?.documents.ineBackUrl,
            selfie: client?.documents.selfieUrl,
            contract: client?.documents.contractUrl,
          });
          toast.success("Consentimiento renovado.");
          onClose();
          await onDone();
        } catch (e) {
          toast.error((e as Error).message);
        }
      }}
    />
  );
}
