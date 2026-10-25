import { useEffect, useMemo, useState } from "react";
import { FormDialog } from "./form-dialog";
import { FieldLabel, Select, Textarea, InfoNote } from "./ui-kit";
import { useRejectionReasons } from "@/hooks/queries";
import type { RejectionReason } from "@/lib/api/types";

/**
 * Rechazo con motivo codificado.
 * Héctor ve qué falló (INE, RFC, cuenta…) y el cliente recibe un mensaje
 * orientador para corregir, no solo "rechazado".
 */
export function ReasonDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  appliesTo,
  belvoHint,
  confirmLabel = "Rechazar",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (code: string, message: string) => Promise<void> | void;
  title: string;
  description?: string;
  appliesTo: RejectionReason["appliesTo"][number];
  /** Código de fallo que devolvió Belvo, para sugerir el motivo. */
  belvoHint?: string | null;
  confirmLabel?: string;
}) {
  const { data: reasons = [] } = useRejectionReasons();
  const options = useMemo(() => reasons.filter((r) => r.appliesTo.includes(appliesTo)), [reasons, appliesTo]);
  const suggested = useMemo(
    () => (belvoHint ? options.find((r) => r.belvoCodes.includes(belvoHint)) : undefined),
    [options, belvoHint],
  );
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initial = suggested ?? options[0];
    setCode(initial?.code ?? "");
    setMessage(initial?.clientMessage ?? "");
  }, [open, suggested, options]);

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      submitLabel={confirmLabel}
      isSubmitting={busy}
      size="lg"
      onSubmit={async () => {
        if (!code) return;
        setBusy(true);
        try {
          await onConfirm(code, message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {suggested && (
        <InfoNote>
          Belvo devolvió <strong>{belvoHint}</strong>; se sugiere el motivo “{suggested.label}”.
        </InfoNote>
      )}
      <div>
        <FieldLabel htmlFor="reason">Motivo</FieldLabel>
        <Select
          id="reason"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setMessage(options.find((r) => r.code === e.target.value)?.clientMessage ?? "");
          }}
        >
          {options.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <FieldLabel htmlFor="reason-msg" hint="(lo verá el cliente; puedes ajustarlo)">
          Mensaje para el cliente
        </FieldLabel>
        <Textarea id="reason-msg" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
    </FormDialog>
  );
}
