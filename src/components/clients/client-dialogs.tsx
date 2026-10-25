import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Crown, Eye, PencilLine, ShieldCheck, UserCheck, UserPlus, Landmark } from "lucide-react";
import { ActionsDropdown, type ActionItem } from "@/components/actions-dropdown";
import { FormDialog } from "@/components/form-dialog";
import { ModalDialog } from "@/components/modal-dialog";
import { WizardModal } from "@/components/wizard-modal";
import { FileDropzone } from "@/components/file-dropzone";
import { ReasonDialog } from "@/components/reason-dialog";
import { BtnOutline, BtnPrimary, Input } from "@/components/portal-shell";
import { DetailGrid, FieldLabel, InfoNote, KycBadge, Select, Spinner } from "@/components/ui-kit";
import { ClientFormFields, EMPTY_CLIENT, validateClient, type ClientFormValues } from "./client-form";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { date, money } from "@/lib/format";
import { useBackofficeUsers, usePlans, useRefreshAll } from "@/hooks/queries";
import { createClient, reviewIdentity, updateClient, uploadClientDocument, type DocumentKey } from "@/lib/api/clients";
import { assignMembership } from "@/lib/api/memberships";
import type { Client } from "@/lib/api/types";

/* ───────────── Editar datos ───────────── */

export function toFormValues(c: Client): ClientFormValues {
  return {
    personType: c.personType,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    rfc: c.rfc,
    curp: c.curp,
    ineKey: c.ineKey,
    birthDate: c.birthDate?.slice(0, 10) ?? "",
    addressParts: {
      pais: "México",
      ...c.addressParts,
      calle: c.addressParts.calle ?? (Object.keys(c.addressParts).length ? "" : c.address),
    },
  };
}

export function EditClientDialog({ client, open, onClose }: { client: Client; open: boolean; onClose: () => void }) {
  const refresh = useRefreshAll();
  const [v, setV] = useState<ClientFormValues>(toFormValues(client));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setV(toFormValues(client));
      setErrors({});
    }
  }, [open, client]);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Editar datos del cliente"
      description={`${client.code} · ${client.fullName}`}
      submitLabel="Guardar cambios"
      size="xl"
      isSubmitting={busy}
      onSubmit={async () => {
        const e = validateClient(v);
        setErrors(e);
        if (Object.keys(e).length) return;
        setBusy(true);
        try {
          await updateClient(client.id, v);
          toast.success("Datos actualizados.");
          onClose();
          await refresh();
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {!Object.keys(client.addressParts).length && client.address && (
        <InfoNote>
          Dirección anterior (un solo campo): <strong>{client.address}</strong>. Captúrala desglosada para que quede completa.
        </InfoNote>
      )}
      <ClientFormFields value={v} onChange={setV} errors={errors} />
    </FormDialog>
  );
}

/* ───────────── Documentos ───────────── */

export const DOC_LABEL: Record<DocumentKey, string> = {
  ineFrontUrl: "INE — frente",
  ineBackUrl: "INE — reverso",
  rfcUrl: "Constancia de RFC",
  addressProofUrl: "Comprobante de domicilio",
  curpUrl: "CURP",
  selfieUrl: "Selfie",
  contractUrl: "Contrato de membresía",
};

export const REQUIRED_DOCS: DocumentKey[] = ["ineFrontUrl", "ineBackUrl"];

export function DocumentTile({
  client,
  docKey,
  editable,
}: {
  client: Client;
  docKey: DocumentKey;
  editable: boolean;
}) {
  const url = client.documents[docKey];
  const refresh = useRefreshAll();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const isPdf = !!url && /\.pdf($|\?)/i.test(url);
  const onFile = async (f: File | null) => {
    if (!f) return;
    setUploading(true);
    try {
      await uploadClientDocument(client.id, docKey, f);
      toast.success(`${DOC_LABEL[docKey]} actualizado.`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card flex flex-col">
      <div className="aspect-[16/10] bg-muted/50 flex items-center justify-center overflow-hidden">
        {uploading ? (
          <Spinner className="text-muted-foreground" />
        ) : url ? (
          isPdf ? (
            <span className="text-xs text-muted-foreground">Documento PDF</span>
          ) : (
            <img src={url} alt={DOC_LABEL[docKey]} className="w-full h-full object-cover" />
          )
        ) : (
          <span className="text-xs text-muted-foreground">Sin documento</span>
        )}
      </div>
      <div className="p-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate">{DOC_LABEL[docKey]}</div>
          <div className="text-[11px] text-muted-foreground">
            {REQUIRED_DOCS.includes(docKey) ? "Obligatorio" : docKey === "curpUrl" ? "Opcional" : "Complementario"}
          </div>
        </div>
        <div className="flex gap-1">
          {url && (
            <button type="button" className="p-1.5 rounded-md hover:bg-muted" title="Ver" onClick={() => setPreview(true)}>
              <Eye size={15} />
            </button>
          )}
          {editable && (
            <label className="p-1.5 rounded-md hover:bg-muted cursor-pointer" title={url ? "Reemplazar" : "Subir"}>
              <PencilLine size={15} />
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
        </div>
      </div>
      {url && (
        <ModalDialog open={preview} onClose={() => setPreview(false)} title={DOC_LABEL[docKey]} description={client.fullName} size="xl">
          {isPdf ? (
            <iframe src={url} title={DOC_LABEL[docKey]} className="w-full h-[70vh] rounded" />
          ) : (
            <img src={url} alt={DOC_LABEL[docKey]} className="w-full rounded" />
          )}
          <div className="mt-3 text-right">
            <a href={url} target="_blank" rel="noreferrer" className="text-sm text-brand font-semibold">
              Abrir en otra pestaña
            </a>
          </div>
        </ModalDialog>
      )}
    </div>
  );
}

/* ───────────── Revisión de identidad ───────────── */

export function KycReviewDialog({ client, open, onClose }: { client: Client; open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const refresh = useRefreshAll();
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const missing = REQUIRED_DOCS.filter((k) => !client.documents[k]);
  const approve = async () => {
    setBusy(true);
    try {
      await reviewIdentity(client.id, { status: "verificado" }, profile?.fullName ?? "Administrador");
      toast.success("Identidad verificada. Queda aprobada para tarjeta y préstamo.");
      onClose();
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <ModalDialog open={open && !rejecting} onClose={onClose} title="Revisar identidad" description={`${client.code} · ${client.fullName}`} size="xl">
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Estatus actual:</span>
            <KycBadge status={client.kyc.status} />
          </div>
          <DetailGrid
            cols={3}
            items={[
              { label: "Nombre", value: client.fullName },
              { label: "RFC", value: <span className="font-mono">{client.rfc}</span> },
              { label: "CURP", value: client.curp ? <span className="font-mono">{client.curp}</span> : "No capturado (opcional)" },
              { label: "Clave INE", value: <span className="font-mono">{client.ineKey}</span> },
              { label: "Nacimiento", value: date(client.birthDate) },
              { label: "Domicilio", value: client.address },
            ]}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(["ineFrontUrl", "ineBackUrl", "rfcUrl", "addressProofUrl", "curpUrl"] as DocumentKey[]).map((k) => (
              <DocumentTile key={k} client={client} docKey={k} editable />
            ))}
          </div>
          <InfoNote>
            Compara a simple vista que el nombre coincida con la INE y que las fotos se lean. No se valida el CURP ni la clave INE
            contra el documento, para no rebotar clientes.
          </InfoNote>
          {missing.length > 0 && (
            <p className="text-sm text-amber-700">Falta: {missing.map((k) => DOC_LABEL[k]).join(", ")}. Súbelos o rechaza con el motivo correspondiente.</p>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <BtnOutline type="button" onClick={() => setRejecting(true)}>
              Rechazar con motivo
            </BtnOutline>
            <BtnPrimary type="button" onClick={approve} disabled={busy || missing.length > 0}>
              {busy && <Spinner />} Aprobar identidad
            </BtnPrimary>
          </div>
        </div>
      </ModalDialog>
      <ReasonDialog
        open={open && rejecting}
        onClose={() => setRejecting(false)}
        title="Rechazar identidad"
        description={client.fullName}
        appliesTo="identidad"
        onConfirm={async (code, msg) => {
          try {
            await reviewIdentity(client.id, { status: "rechazado", reasonCode: code, reasonMessage: msg }, profile?.fullName ?? "Administrador");
            toast.success("Identidad rechazada. El cliente recibió el mensaje para corregir.");
            setRejecting(false);
            onClose();
            await refresh();
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </>
  );
}

/* ───────────── Membresía manual ───────────── */

export function AssignMembershipDialog({ client, open, onClose }: { client: Client; open: boolean; onClose: () => void }) {
  const { data: plans = [] } = usePlans();
  const refresh = useRefreshAll();
  const active = plans.filter((p) => p.active);
  const [planId, setPlanId] = useState("");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setPlanId(active[0]?.id ?? "");
  }, [open, active.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Asignar membresía"
      description="Para pagos recibidos fuera de Conekta (transferencia o efectivo)."
      submitLabel="Asignar"
      isSubmitting={busy}
      onSubmit={async () => {
        if (!planId) return;
        setBusy(true);
        try {
          await assignMembership(client.id, planId, start);
          toast.success("Membresía asignada.");
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
        <FieldLabel>Plan</FieldLabel>
        <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {active.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {money(p.price)}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <FieldLabel>Inicio</FieldLabel>
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </div>
    </FormDialog>
  );
}

/* ───────────── Ejecutivo ───────────── */

export function ExecutiveDialog({ client, open, onClose }: { client: Client; open: boolean; onClose: () => void }) {
  const { data: users = [] } = useBackofficeUsers();
  const refresh = useRefreshAll();
  const [exec, setExec] = useState(client.executiveId ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Ejecutivo que dio de alta al cliente"
      description="Se usa para atribución de ventas y para resolver quién trajo a cada cliente."
      submitLabel="Guardar"
      isSubmitting={busy}
      onSubmit={async () => {
        setBusy(true);
        try {
          await updateClient(client.id, { executiveId: exec || null });
          toast.success("Ejecutivo actualizado.");
          onClose();
          await refresh();
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Select value={exec} onChange={(e) => setExec(e.target.value)}>
        <option value="">Registro directo (sin ejecutivo)</option>
        {users
          .filter((u) => u.active)
          .map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {u.location ? ` · ${u.location}` : ""}
            </option>
          ))}
      </Select>
    </FormDialog>
  );
}

/* ───────────── Menú ⋯ del cliente ───────────── */

export function ClientActions({ client }: { client: Client }) {
  const navigate = useNavigate();
  const refresh = useRefreshAll();
  const { profile } = useAuth();
  const mayEdit = can(profile?.role, "clientes", "editar");
  const mayReview = can(profile?.role, "clientes.identidad", "editar");
  const [open, setOpen] = useState<null | "edit" | "kyc" | "membership" | "exec">(null);
  const close = () => setOpen(null);
  const noPerm = "Tu rol no tiene permiso para esta acción.";
  const items: ActionItem[] = [
    { label: "Ver detalles", icon: Eye, onClick: () => navigate({ to: "/admin/general/usuarios/$id", params: { id: client.id } }) },
    { label: "Editar datos", icon: PencilLine, disabled: !mayEdit, hint: noPerm, onClick: () => setOpen("edit") },
    {
      label: client.kyc.status === "verificado" ? "Ver identidad" : "Revisar identidad",
      icon: ShieldCheck,
      disabled: !mayReview,
      hint: noPerm,
      onClick: () => setOpen("kyc"),
    },
    { label: "Asignar membresía", icon: Crown, divider: true, disabled: !mayEdit, hint: noPerm, onClick: () => setOpen("membership") },
    {
      label: client.loanEligible ? "Quitar invitación a préstamo" : "Invitar a préstamo",
      icon: Landmark,
      disabled: !can(profile?.role, "prestamos.aprobar", "editar"),
      hint: noPerm,
      onClick: async () => {
        try {
          await updateClient(client.id, { loanEligible: !client.loanEligible });
          toast.success(client.loanEligible ? "El cliente ya no verá la opción de préstamo." : "El cliente verá la opción de préstamo en su app.");
          await refresh();
        } catch (e) {
          toast.error((e as Error).message);
        }
      },
    },
    { label: "Asignar ejecutivo", icon: UserCheck, disabled: !mayEdit, hint: noPerm, onClick: () => setOpen("exec") },
  ];
  return (
    <>
      <ActionsDropdown actions={items} />
      {open === "edit" && <EditClientDialog client={client} open onClose={close} />}
      {open === "kyc" && <KycReviewDialog client={client} open onClose={close} />}
      {open === "membership" && <AssignMembershipDialog client={client} open onClose={close} />}
      {open === "exec" && <ExecutiveDialog client={client} open onClose={close} />}
    </>
  );
}

/* ───────────── Alta asistida ───────────── */

export function NewClientButton() {
  const [open, setOpen] = useState(false);
  const { profile } = useAuth();
  if (!can(profile?.role, "clientes.alta", "editar")) return null;
  return (
    <>
      <BtnPrimary type="button" onClick={() => setOpen(true)}>
        <UserPlus size={16} /> Alta asistida
      </BtnPrimary>
      {open && <NewClientWizard open onClose={() => setOpen(false)} />}
    </>
  );
}

function NewClientWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const refresh = useRefreshAll();
  const { data: users = [] } = useBackofficeUsers();
  const { data: plans = [] } = usePlans();
  const [v, setV] = useState<ClientFormValues>(EMPTY_CLIENT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Partial<Record<DocumentKey, File | null>>>({});
  const [exec, setExec] = useState<string>(profile?.role === "agente" ? profile.id : "");
  const [eligible, setEligible] = useState(false);
  const [contractMode, setContractMode] = useState<"signnow" | "escaneado" | "despues">("signnow");
  const [planId, setPlanId] = useState("");
  const [busy, setBusy] = useState(false);
  const errorCount = Object.keys(validateClient(v)).length;

  const finish = async () => {
    const e = validateClient(v);
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Revisa los datos personales: hay campos incompletos.");
      return;
    }
    setBusy(true);
    try {
      const c = await createClient(
        { ...v, executiveId: exec || null, loanEligible: eligible, files, contractMode, planId: planId || null },
        profile?.fullName ?? "Administrador",
      );
      toast.success(`Cliente ${c.code || c.fullName} creado.`);
      if (c.contractWarning) toast.warning(c.contractWarning);
      onClose();
      await refresh();
      navigate({ to: "/admin/general/usuarios/$id", params: { id: c.id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <WizardModal
      open={open}
      onClose={onClose}
      title="Alta asistida de cliente"
      finishLabel={busy ? "Creando…" : "Crear cliente"}
      finishDisabled={busy}
      onFinish={finish}
      steps={[
        {
          label: "Datos personales",
          content: <ClientFormFields value={v} onChange={setV} errors={errors} />,
        },
        {
          label: "Documentos",
          content: (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Sube las fotos que el cliente te envió (por WhatsApp, por ejemplo). INE frente y reverso son obligatorias para
                revisar su identidad; puedes completarlas después desde su ficha.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(["ineFrontUrl", "ineBackUrl", "rfcUrl", "addressProofUrl", "curpUrl"] as DocumentKey[]).map((k) => (
                  <div key={k}>
                    <FieldLabel hint={REQUIRED_DOCS.includes(k) ? "(obligatorio)" : "(opcional)"}>{DOC_LABEL[k]}</FieldLabel>
                    <FileDropzone accept="image/*,.pdf" onFile={(f) => setFiles((p) => ({ ...p, [k]: f }))} />
                  </div>
                ))}
              </div>
            </div>
          ),
        },
        {
          label: "Membresía y contrato",
          content: (
            <div className="space-y-4">
              <div>
                <FieldLabel hint="(opcional; el cliente puede comprarla después desde su app)">Membresía</FieldLabel>
                <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                  <option value="">Sin membresía por ahora</option>
                  {plans
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {money(p.price)}
                      </option>
                    ))}
                </Select>
              </div>
              <div>
                <FieldLabel>Firma del contrato</FieldLabel>
                <div className="space-y-2">
                  {(
                    [
                      ["signnow", "Enviar contrato por SignNow al correo del cliente"],
                      ["escaneado", "Subir contrato firmado y escaneado (en Documentos de su ficha)"],
                      ["despues", "Lo firmará después"],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <input type="radio" className="accent-primary" checked={contractMode === k} onChange={() => setContractMode(k)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ),
        },
        {
          label: "Ejecutivo y confirmación",
          content: (
            <div className="space-y-4">
              <div>
                <FieldLabel>Ejecutivo que lo dio de alta</FieldLabel>
                <Select value={exec} onChange={(e) => setExec(e.target.value)} disabled={profile?.role === "agente"}>
                  <option value="">Registro directo</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-primary" checked={eligible} onChange={(e) => setEligible(e.target.checked)} />
                Invitar a préstamo (verá la opción en su app)
              </label>
              <div className="rounded-lg border border-border p-4">
                <DetailGrid
                  cols={2}
                  items={[
                    { label: "Cliente", value: `${v.firstName} ${v.lastName}`.trim() || "—" },
                    { label: "Correo", value: v.email },
                    { label: "Documentos", value: `${Object.values(files).filter(Boolean).length} cargados` },
                    { label: "Datos", value: errorCount ? `${errorCount} campos por completar` : "Completos" },
                  ]}
                />
              </div>
            </div>
          ),
        },
      ]}
    />
  );
}

