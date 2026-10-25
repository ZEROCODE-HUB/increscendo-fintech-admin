import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ModalDialog } from "@/components/modal-dialog";
import { FormDialog } from "@/components/form-dialog";
import { Badge, BtnOutline, Input } from "@/components/portal-shell";
import { DetailGrid, FieldLabel, InfoNote, Select, Spinner, Textarea } from "@/components/ui-kit";
import { FileDropzone } from "@/components/file-dropzone";
import { useBanks, useSchedule } from "@/hooks/queries";
import { date, dateTime, maskClabe, money } from "@/lib/format";
import { bankName, providerForBank } from "@/lib/api/catalogs-data";
import { INSTALLMENT_LABEL, failedReasonLabel, loanStatusLabel } from "@/lib/loans/status";
import { calculateMonthlyPayment, generateSchedulePdfBase64, normalizeMonthlyRate } from "@/lib/loans/schedule";
import type { Installment, Loan } from "@/lib/api/types";

/* ───────────── Detalle ───────────── */

export function LoanDetailDialog({ loan, open, onClose }: { loan: Loan; open: boolean; onClose: () => void }) {
  const st = loanStatusLabel(loan);
  return (
    <ModalDialog open={open} onClose={onClose} title={`Préstamo ${loan.folio}`} description={loan.clientName} size="xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={st.tone}>{st.label}</Badge>
          <Badge tone="neutral">Membresía: {loan.membershipName}</Badge>
          {loan.consentStatus && (
            <Badge tone={loan.consentStatus === "confirmed" ? "success" : "warn"}>
              Consentimiento {loan.consentStatus === "confirmed" ? "confirmado" : "pendiente"}
            </Badge>
          )}
          <Badge tone="info">Cobro por {providerForBank(loan.bank) === "druo" ? "Druo" : "Belvo"}</Badge>
        </div>
        <DetailGrid
          cols={4}
          items={[
            { label: "Monto", value: money(loan.amount) },
            { label: "Plazo", value: `${loan.installments} cuotas` },
            { label: "Cuota mensual", value: money(loan.monthlyPayment) },
            { label: "Tasa anual", value: `${(loan.interestRate > 1 ? loan.interestRate : loan.interestRate * 100).toFixed(2)}%` },
            { label: "Total a pagar", value: money(loan.totalToPay) },
            { label: "Pagado", value: `${money(loan.paidAmount)} (${loan.paidInstallments}/${loan.installments})` },
            { label: "Próximo pago", value: date(loan.nextPaymentDate) },
            { label: "Días de atraso", value: loan.daysOverdue || "0" },
          ]}
        />
        <div className="border-t pt-4">
          <DetailGrid
            cols={4}
            items={[
              { label: "Solicitud", value: date(loan.appliedAt) },
              { label: "Aprobación", value: date(loan.approvedAt) },
              { label: "Firma", value: date(loan.signedAt) },
              { label: "Desembolso", value: date(loan.disbursedAt) },
              { label: "Banco", value: bankName(loan.bank) },
              { label: "CLABE", value: <span className="font-mono">{maskClabe(loan.clabe)}</span> },
              { label: "INE", value: loan.ineKey },
              { label: "CURP", value: loan.curp || "No capturado" },
            ]}
          />
        </div>
        {loan.rejection && (
          <InfoNote>
            <strong>Rechazado por: {loan.rejection.code}.</strong> Mensaje enviado al cliente: “{loan.rejection.message}”
          </InfoNote>
        )}
        <div className="border-t pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Avisos de cobranza enviados</h4>
          {loan.notices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin avisos enviados.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {loan.notices.map((n, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{n.installment ? `Cuota ${n.installment}` : "Saldo pendiente"} · correo</span>
                  <span className="text-muted-foreground">
                    {dateTime(n.sentAt)} · {n.sentBy ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ModalDialog>
  );
}

/* ───────────── Cronograma ───────────── */

export function InstallmentsTable({
  rows,
  selectable,
  selected,
  onToggle,
}: {
  rows: Installment[];
  selectable?: (r: Installment) => boolean;
  selected?: Set<number>;
  onToggle?: (n: number) => void;
}) {
  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            {selectable && <th className="w-10 px-3 py-2" />}
            <th className="px-3 py-2 text-left font-semibold">Cuota</th>
            <th className="px-3 py-2 text-left font-semibold">Vence</th>
            <th className="px-3 py-2 text-right font-semibold">Monto</th>
            <th className="px-3 py-2 text-left font-semibold">Estatus</th>
            <th className="px-3 py-2 text-left font-semibold">Pagada</th>
            <th className="px-3 py-2 text-left font-semibold">Observación</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const st = INSTALLMENT_LABEL[r.status];
            const can = selectable?.(r) ?? false;
            return (
              <tr key={r.number} className="border-b last:border-0">
                {selectable && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      disabled={!can}
                      checked={selected?.has(r.number) ?? false}
                      onChange={() => onToggle?.(r.number)}
                    />
                  </td>
                )}
                <td className="px-3 py-2">#{r.number}</td>
                <td className="px-3 py-2 whitespace-nowrap">{date(r.dueDate)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(r.amount)}</td>
                <td className="px-3 py-2">
                  <Badge tone={st.tone}>{st.label}</Badge>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{date(r.paidAt)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{failedReasonLabel(r.failedReason) ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ScheduleDialog({ loan, open, onClose }: { loan: Loan; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useSchedule(open ? loan : null);
  const rows = data?.installments ?? [];
  const counts = useMemo(() => {
    const c = { pagado: 0, pendiente: 0, atrasado: 0, otros: 0 };
    for (const r of rows) {
      if (r.status === "pagado") c.pagado++;
      else if (r.status === "pendiente" || r.status === "en_proceso") c.pendiente++;
      else if (r.status === "atrasado" || r.status === "rechazado") c.atrasado++;
      else c.otros++;
    }
    return c;
  }, [rows]);

  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      ["Cuota", "Vence", "Monto (MXN)", "Estatus", "Pagada", "Observación"],
      ...rows.map((r) => [r.number, date(r.dueDate), r.amount, INSTALLMENT_LABEL[r.status].label, date(r.paidAt), failedReasonLabel(r.failedReason) ?? ""]),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cronograma");
    XLSX.writeFile(wb, `cronograma-${loan.folio}.xlsx`);
  };

  return (
    <ModalDialog open={open} onClose={onClose} title={`Cronograma · ${loan.folio}`} description={loan.clientName} size="xl">
      {isLoading ? (
        <div className="py-12 flex justify-center text-muted-foreground">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone="success">{counts.pagado} pagadas</Badge>
              <Badge tone="neutral">{counts.pendiente} pendientes</Badge>
              <Badge tone="warn">{counts.atrasado} atrasadas o rechazadas</Badge>
              <Badge tone="info">Fuente: {data?.source === "belvo" ? "Belvo" : "Calculado"}</Badge>
            </div>
            <BtnOutline type="button" onClick={exportXlsx} disabled={!rows.length}>
              <Download size={16} /> Exportar
            </BtnOutline>
          </div>
          {data?.source === "calculado" && loan.stage === "activo" && (
            <InfoNote>Belvo no devolvió cuotas para este préstamo; se muestra el cronograma calculado con la tabla francesa.</InfoNote>
          )}
          <InstallmentsTable rows={rows} />
        </div>
      )}
    </ModalDialog>
  );
}

/* ───────────── Aviso de cobranza ───────────── */

export function NoticeDialog({
  loan,
  open,
  onClose,
  onConfirm,
}: {
  loan: Loan;
  open: boolean;
  onClose: () => void;
  onConfirm: (o: { installment: number | null; amount: number; chargeDate: string; extraEmails: string[] }) => Promise<void>;
}) {
  const next = Math.min(loan.paidInstallments + 1, loan.installments);
  const [installment, setInstallment] = useState(String(next));
  const [amount, setAmount] = useState(String(loan.monthlyPayment.toFixed(2)));
  const [chargeDate, setChargeDate] = useState(new Date().toISOString().slice(0, 10));
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setInstallment(String(next));
      setAmount(loan.monthlyPayment.toFixed(2));
      setChargeDate(new Date().toISOString().slice(0, 10));
      setExtra("");
    }
  }, [open, next, loan.monthlyPayment]);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Enviar aviso de cobranza"
      description={`${loan.folio} · ${loan.clientName} · ${loan.email}`}
      submitLabel="Enviar aviso"
      isSubmitting={busy}
      onSubmit={async () => {
        setBusy(true);
        try {
          await onConfirm({
            installment: installment ? Number(installment) : null,
            amount: Number(amount),
            chargeDate: date(chargeDate),
            extraEmails: extra.split(/[,;\s]+/).filter((e) => e.includes("@")),
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-sm text-muted-foreground">
        El cliente recibe un correo avisando que se le hará el cargo. El aviso queda registrado en el préstamo.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Cuota</FieldLabel>
          <Select value={installment} onChange={(e) => setInstallment(e.target.value)}>
            {Array.from({ length: loan.installments - loan.paidInstallments }, (_, i) => loan.paidInstallments + i + 1).map((n) => (
              <option key={n} value={n}>
                Cuota {n} de {loan.installments}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel>Monto</FieldLabel>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      <div>
        <FieldLabel>Fecha del cargo</FieldLabel>
        <Input type="date" value={chargeDate} onChange={(e) => setChargeDate(e.target.value)} />
      </div>
      <div>
        <FieldLabel hint="(opcional, separados por coma)">Copiar a</FieldLabel>
        <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="aval@correo.com" />
      </div>
    </FormDialog>
  );
}

/* ───────────── Ejecutar cobro ───────────── */

export function ChargeDialog({
  loan,
  open,
  onClose,
  onConfirm,
}: {
  loan: Loan;
  open: boolean;
  onClose: () => void;
  onConfirm: (numbers: number[]) => Promise<void>;
}) {
  const { data, isLoading } = useSchedule(open ? loan : null);
  const rows = data?.installments ?? [];
  const chargeable = (r: Installment) => ["pendiente", "atrasado", "rechazado"].includes(r.status);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open || !rows.length) return;
    const first = rows.find(chargeable);
    setSelected(new Set(first ? [first.number] : []));
  }, [open, rows.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = rows.filter((r) => selected.has(r.number)).reduce((s, r) => s + r.amount, 0);
  const provider = providerForBank(loan.bank) === "druo" ? "Druo" : "Belvo";
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Ejecutar cobro bajo demanda"
      description={`${loan.folio} · ${loan.clientName} · ${bankName(loan.bank)} ${maskClabe(loan.clabe)}`}
      submitLabel={selected.size ? `Cobrar ${money(total)}` : "Cobrar"}
      isSubmitting={busy}
      size="xl"
      onSubmit={async () => {
        if (!selected.size) return;
        setBusy(true);
        try {
          await onConfirm(Array.from(selected).sort((a, b) => a - b));
        } finally {
          setBusy(false);
        }
      }}
    >
      <InfoNote>
        Se crea una solicitud de cargo inmediato por <strong>{provider}</strong> a la cuenta domiciliada. El resultado
        (pagado o rechazado) llega por webhook y se refleja en Movimientos y en el cronograma.
      </InfoNote>
      {isLoading ? (
        <div className="py-10 flex justify-center text-muted-foreground">
          <Spinner />
        </div>
      ) : (
        <InstallmentsTable
          rows={rows}
          selectable={chargeable}
          selected={selected}
          onToggle={(n) =>
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(n)) next.delete(n);
              else next.add(n);
              return next;
            })
          }
        />
      )}
    </FormDialog>
  );
}

/* ───────────── Modificar términos ───────────── */

export function ModifyTermsDialog({
  loan,
  open,
  onClose,
  onConfirm,
}: {
  loan: Loan;
  open: boolean;
  onClose: () => void;
  onConfirm: (t: { amount: number; installments: number; annualRate: number; monthlyPayment: number; totalToPay: number }) => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(loan.amount));
  const [installments, setInstallments] = useState(String(loan.installments));
  const [rate, setRate] = useState(String(((loan.interestRate > 1 ? loan.interestRate / 100 : loan.interestRate) * 100).toFixed(2)));
  const [busy, setBusy] = useState(false);
  const a = Number(amount);
  const n = Number(installments);
  const r = Number(rate) / 100;
  const monthly = calculateMonthlyPayment(a, normalizeMonthlyRate(r), n);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Modificar términos"
      description={`${loan.folio} · ${loan.clientName}`}
      submitLabel="Guardar términos"
      isSubmitting={busy}
      onSubmit={async () => {
        if (!(a > 0 && n > 0)) return;
        setBusy(true);
        try {
          await onConfirm({ amount: a, installments: n, annualRate: r, monthlyPayment: monthly, totalToPay: monthly * n });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-3 gap-3">
        <div>
          <FieldLabel>Monto</FieldLabel>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Cuotas</FieldLabel>
          <Input type="number" value={installments} onChange={(e) => setInstallments(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Tasa anual %</FieldLabel>
          <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
      </div>
      <DetailGrid
        cols={2}
        items={[
          { label: "Cuota mensual", value: money(monthly) },
          { label: "Total a pagar", value: money(monthly * n) },
        ]}
      />
    </FormDialog>
  );
}

/* ───────────── Archivo (contrato firmado / voucher / venta de cartera) ───────────── */

export function FileActionDialog({
  open,
  onClose,
  title,
  description,
  accept,
  required,
  submitLabel,
  withComment,
  children,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  accept?: string;
  required?: boolean;
  submitLabel: string;
  withComment?: boolean;
  children?: React.ReactNode;
  onConfirm: (file: File | null, comment: string) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setFile(null);
      setComment("");
    }
  }, [open]);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      submitLabel={submitLabel}
      isSubmitting={busy}
      onSubmit={async () => {
        if (required && !file) return;
        setBusy(true);
        try {
          await onConfirm(file, comment);
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      <FileDropzone onFile={setFile} accept={accept} />
      {required && !file && <p className="text-xs text-muted-foreground">El archivo es obligatorio.</p>}
      {withComment && (
        <div>
          <FieldLabel>Comentario</FieldLabel>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
      )}
    </FormDialog>
  );
}

/* ───────────── Cuenta de desembolso ───────────── */

export function AccountDialog({
  loan,
  open,
  onClose,
  onConfirm,
}: {
  loan: Loan;
  open: boolean;
  onClose: () => void;
  onConfirm: (bank: string, clabe: string) => Promise<void>;
}) {
  const { data: banks = [] } = useBanks();
  const [bank, setBank] = useState(loan.bank);
  const [clabe, setClabe] = useState(loan.clabe);
  const [busy, setBusy] = useState(false);
  const valid = /^\d{18}$/.test(clabe);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Cambiar cuenta de desembolso"
      description={`${loan.folio} · ${loan.clientName}`}
      submitLabel="Guardar cuenta"
      isSubmitting={busy}
      onSubmit={async () => {
        if (!valid) return;
        setBusy(true);
        try {
          await onConfirm(bank, clabe);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <FieldLabel>Banco</FieldLabel>
        <Select value={bank} onChange={(e) => setBank(e.target.value)}>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <FieldLabel hint="(18 dígitos)">CLABE</FieldLabel>
        <Input value={clabe} onChange={(e) => setClabe(e.target.value.replace(/\D/g, "").slice(0, 18))} className="font-mono" />
        {!valid && clabe && <p className="text-xs text-red-600 mt-1">La CLABE debe tener 18 dígitos.</p>}
      </div>
      {providerForBank(bank) === "druo" && <InfoNote>BBVA Bancomer: los cargos de este préstamo se harán por Druo.</InfoNote>}
    </FormDialog>
  );
}

/* ───────────── Pago externo ───────────── */

export function ExternalPaymentDialog({
  loan,
  open,
  onClose,
  onConfirm,
}: {
  loan: Loan;
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number, reference: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState(loan.monthlyPayment.toFixed(2));
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Registrar pago externo"
      description="Pago recibido por transferencia o depósito, fuera de la domiciliación."
      submitLabel="Registrar pago"
      isSubmitting={busy}
      onSubmit={async () => {
        if (!(Number(amount) > 0) || !reference.trim()) return;
        setBusy(true);
        try {
          await onConfirm(Number(amount), reference.trim());
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Monto</FieldLabel>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Referencia</FieldLabel>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Folio SPEI / ticket" />
        </div>
      </div>
    </FormDialog>
  );
}

export async function downloadSchedulePdf(loan: Loan) {
  const b64 = await generateSchedulePdfBase64(loan);
  const a = document.createElement("a");
  a.href = `data:application/pdf;base64,${b64}`;
  a.download = `tabla-amortizacion-${loan.folio}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

