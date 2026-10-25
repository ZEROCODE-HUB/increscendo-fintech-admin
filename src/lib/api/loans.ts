import { supabase, requireSupabase } from "@/lib/supabase";
import { apiFetch } from "./http";
import { isDemoMode, wait } from "./source";
import { demoLoans, demoMovements } from "./demo-data";
import { sendEmail } from "./email";
import { logActivity } from "./activity";
import { uploadToStorage } from "./clients";
import { bankName, DEFAULT_REJECTION_REASONS } from "./catalogs-data";
import {
  collectionNoticeTemplate,
  disbursementConfirmedTemplate,
  loanApprovedTemplate,
  loanRejectedTemplate,
} from "./email-templates";
import { mapBelvoInstallmentStatus, stageFromDb } from "@/lib/loans/status";
import { computedInstallments, generateSchedulePdfBase64 } from "@/lib/loans/schedule";
import { daysBetween, maskClabe } from "@/lib/format";
import type { CollectionNotice, Installment, Loan, LoanDbStatus, LoanSchedule } from "./types";

/* ───────────── Mapeo desde la tabla `loans` ───────────── */

const LOAN_SELECT =
  "id, loan_number, amount, installments, monthly_payment, interest_rate, total_to_pay, status, status_consent, applied_at, created_at, approved_at, signed_at, disbursed_at, metadata, user_id, " +
  "users(first_name,last_name,ine_key,curp,phone,email,user_memberships(status,membership_plans(name))), loan_signatures(id), loan_disbursements(destination_account,created_at)";

function iso(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function mapLoanRow(l: Record<string, any>): Loan {
  const user = l.users ?? {};
  const meta = (l.metadata ?? {}) as Record<string, any>;
  const dbStatus = String(l.status) as LoanDbStatus;
  const amount = Number(l.amount ?? 0);
  const installments = Number(l.installments ?? meta.installments ?? 12);
  const monthly = Number(l.monthly_payment ?? (installments ? amount / installments : amount));
  const paidAmount = Number(meta.paid_amount ?? 0);
  const paidInstallments = monthly > 0 ? Math.min(installments, Math.floor(paidAmount / monthly + 0.001)) : 0;
  const disb = Array.isArray(l.loan_disbursements) && l.loan_disbursements.length ? l.loan_disbursements[0] : null;
  const sig = Array.isArray(l.loan_signatures) && l.loan_signatures.length ? l.loan_signatures[0] : null;
  const memberships = Array.isArray(user.user_memberships) ? user.user_memberships : [];
  const activeMembership = memberships.find((m: any) => m.status === "active") ?? memberships[0];

  // Próximo pago: el que guarda la sincronización con Belvo o, en su defecto, el calculado.
  let next: string | null = iso(meta.next_payment_date);
  if (!next && dbStatus === "active") {
    const base = l.disbursed_at ?? l.approved_at ?? l.applied_at ?? l.created_at;
    if (base) {
      const d = new Date(base);
      d.setMonth(d.getMonth() + paidInstallments + 1);
      next = d.toISOString();
    }
  }
  const today = new Date();
  const overdueDays =
    dbStatus === "active" && next && new Date(next) < today && paidAmount < Number(l.total_to_pay ?? amount)
      ? Math.max(1, daysBetween(new Date(next), today))
      : 0;

  const notices = (Array.isArray(meta.collection_notices) ? meta.collection_notices : []) as CollectionNotice[];
  const rejection = meta.rejection && typeof meta.rejection === "object" ? (meta.rejection as Loan["rejection"]) : null;

  return {
    id: String(l.id),
    folio: String(l.loan_number ?? l.id).toString(),
    userId: String(l.user_id ?? ""),
    clientName: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "—",
    email: user.email ?? "",
    phone: user.phone ?? "",
    ineKey: user.ine_key ?? meta.ine_key ?? "",
    curp: user.curp ?? meta.curp ?? "",
    amount,
    installments,
    monthlyPayment: monthly,
    interestRate: Number(l.interest_rate ?? meta.interest_rate ?? 0.42),
    totalToPay: Number(l.total_to_pay ?? monthly * installments),
    dbStatus,
    stage: stageFromDb(dbStatus),
    consentStatus: l.status_consent ?? null,
    membershipName: activeMembership?.membership_plans?.name ?? (typeof meta.membership === "string" ? meta.membership : "Sin membresía"),
    appliedAt: iso(l.applied_at ?? l.created_at),
    approvedAt: iso(l.approved_at),
    signedAt: iso(l.signed_at),
    disbursedAt: iso(l.disbursed_at),
    paidAmount,
    paidInstallments,
    nextPaymentDate: next,
    lastPaymentDate: iso(meta.last_payment_date),
    daysOverdue: overdueDays,
    bank: disb?.destination_account?.bank ?? meta.depositData?.bank ?? "",
    clabe: disb?.destination_account?.clabe ?? meta.depositData?.clabe ?? "",
    signatureStatus: sig || ["signed", "disbursed", "active", "closed", "paid"].includes(dbStatus) ? "Firmado" : meta.signnow_error ? "Error" : "Espera",
    disbursementStatus: disb || ["disbursed", "active", "closed", "paid"].includes(dbStatus) ? "Desembolsado" : "Pendiente",
    rejection,
    notices,
    portfolioSold: !!meta.portfolio_sold,
    metadata: meta,
  };
}

/* ───────────── Consultas ───────────── */

export async function listLoans(): Promise<Loan[]> {
  if (isDemoMode) {
    await wait();
    return demoLoans.map((l) => ({ ...l }));
  }
  const { data, error } = await requireSupabase()
    .from("loans")
    .select(LOAN_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, any>[]).map(mapLoanRow);
}

export async function listClientLoans(userId: string): Promise<Loan[]> {
  if (isDemoMode) {
    await wait(120);
    return demoLoans.filter((l) => l.userId === userId).map((l) => ({ ...l }));
  }
  const { data, error } = await requireSupabase()
    .from("loans")
    .select(LOAN_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, any>[]).map(mapLoanRow);
}

type ApiInstallment = {
  installment_number: number;
  status: string;
  amount: number;
  due_date: string | null;
  payment_request_id: string | null;
  paid_at: string | null;
  failed_reason: string | null;
};

/**
 * Cronograma de cuotas. Fuente principal: Belvo (`/belvo/loans/:id/installments`).
 * Si Belvo aún no tiene cuotas (antes del desembolso) se muestra el calculado.
 */
export async function getSchedule(loan: Loan): Promise<LoanSchedule> {
  if (isDemoMode || loan.stage !== "activo") {
    if (isDemoMode) await wait(200);
    const rows = computedInstallments(loan);
    if (isDemoMode && loan.daysOverdue > 0) {
      const idx = loan.paidInstallments;
      if (rows[idx]) rows[idx] = { ...rows[idx], status: "rechazado", failedReason: "insufficient_funds" };
    }
    return { source: "calculado", installments: rows, totalPaid: loan.paidAmount };
  }
  try {
    const data = await apiFetch<{ ok: boolean; installments: ApiInstallment[]; total_paid?: number }>(
      `/belvo/loans/${loan.id}/installments`,
    );
    if (!data?.installments?.length) throw new Error("Sin cuotas");
    const installments: Installment[] = [...data.installments]
      .sort((a, b) => a.installment_number - b.installment_number)
      .map((r) => ({
        number: r.installment_number,
        dueDate: r.due_date,
        amount: Number(r.amount ?? 0),
        status: mapBelvoInstallmentStatus(r.status, r.due_date),
        paidAt: r.paid_at,
        paymentRequestId: r.payment_request_id,
        failedReason: r.failed_reason,
      }));
    return { source: "belvo", installments, totalPaid: Number(data.total_paid ?? loan.paidAmount) };
  } catch {
    return { source: "calculado", installments: computedInstallments(loan), totalPaid: loan.paidAmount };
  }
}

/* ───────────── Helpers de escritura ───────────── */

function demoLoan(id: string): Loan {
  const l = demoLoans.find((x) => x.id === id);
  if (!l) throw new Error("Préstamo no encontrado");
  return l;
}

async function patchLoanMetadata(loanId: string, patch: Record<string, unknown>) {
  const sb = requireSupabase();
  const { data, error } = await sb.from("loans").select("metadata").eq("id", loanId).single();
  if (error) throw error;
  const next = { ...((data?.metadata as Record<string, unknown>) ?? {}), ...patch };
  const { error: upErr } = await sb.from("loans").update({ metadata: next }).eq("id", loanId);
  if (upErr) throw upErr;
}

async function rpcStatus(loanId: string, action: "approve" | "reject" | "disburse") {
  const { data, error } = await requireSupabase().rpc("admin_update_loan_status", {
    p_loan_id: loanId,
    p_action: action,
  });
  if (error) throw error;
  if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);
}

async function notify(userId: string, type: string, title: string, message: string) {
  if (!supabase || !userId) return;
  await supabase.from("notifications").insert({ user_id: userId, type, title, message, url: "/my-loans", channels: ["email"] });
}

const fmtAmount = (n: number) => n.toLocaleString("es-MX", { minimumFractionDigits: 2 });

/* ───────────── Acciones: Solicitudes ───────────── */

/** Aprueba la solicitud: estatus → aprobado, envía contrato por SignNow con la tabla de amortización y correo. */
export async function approveLoan(loan: Loan, onStep?: (msg: string) => void): Promise<void> {
  if (isDemoMode) {
    for (const m of ["Actualizando estado…", "Preparando contrato…", "Enviando invitación de firma…", "Enviando correo…"]) {
      onStep?.(m);
      await wait(350);
    }
    const l = demoLoan(loan.id);
    l.dbStatus = "approved";
    l.stage = "firma";
    l.approvedAt = new Date().toISOString();
    void logActivity("Aprobó solicitud", "Préstamo", loan.folio, "Contrato enviado por SignNow");
    return;
  }
  onStep?.("Actualizando estado del préstamo…");
  await rpcStatus(loan.id, "approve");
  await notify(loan.userId, "loan_signature_pending", "Firma pendiente", "Tienes una firma pendiente. Revisa tu correo para firmar el contrato.");
  if (loan.email) {
    try {
      onStep?.("Preparando contrato y tabla de amortización…");
      const pdf = await generateSchedulePdfBase64(loan);
      onStep?.("Enviando invitación de firma…");
      const invite = await apiFetch<Record<string, unknown>>("/signnow-invite", {
        method: "POST",
        body: JSON.stringify({
          loan_id: loan.id,
          recipient_email: loan.email,
          optional_pdf_base64: pdf,
          optional_pdf_name: `tabla-amortizacion-${loan.folio}.pdf`,
        }),
      });
      const updates: Record<string, unknown> = { metadata: { ...loan.metadata, signnow_invite: invite, signnow_error: null } };
      if (invite?.docId) updates.id_document = invite.docId;
      await requireSupabase().from("loans").update(updates).eq("id", loan.id);
    } catch (e) {
      await patchLoanMetadata(loan.id, { signnow_error: (e as Error).message });
    }
    onStep?.("Enviando correo de notificación…");
    await sendEmail({
      to: loan.email,
      subject: "¡Préstamo Pre Aprobado!",
      html: loanApprovedTemplate({
        name: loan.clientName,
        loanId: loan.folio,
        amount: fmtAmount(loan.amount),
        installments: String(loan.installments),
        bank: bankName(loan.bank),
        clabe: maskClabe(loan.clabe),
      }),
      text: `Hola ${loan.clientName}, tu préstamo ${loan.folio} fue preaprobado. Revisa tu correo para firmar el contrato.`,
    }).catch(() => undefined);
  }
  void logActivity("Aprobó solicitud", "Préstamo", loan.folio, "Contrato enviado por SignNow");
}

/** Rechaza con motivo codificado. El cliente recibe el mensaje orientador del catálogo. */
export async function rejectLoan(loan: Loan, reasonCode: string, customMessage?: string): Promise<void> {
  const reason = DEFAULT_REJECTION_REASONS.find((r) => r.code === reasonCode);
  const message = customMessage?.trim() || reason?.clientMessage || "";
  if (isDemoMode) {
    await wait(400);
    const l = demoLoan(loan.id);
    l.dbStatus = "rejected";
    l.stage = "cerrado";
    l.rejection = { code: reasonCode, message };
    void logActivity("Rechazó solicitud", "Préstamo", loan.folio, `Motivo: ${reasonCode}`);
    return;
  }
  await rpcStatus(loan.id, "reject");
  await patchLoanMetadata(loan.id, { rejection: { code: reasonCode, message, at: new Date().toISOString() } });
  await notify(loan.userId, "loan_rejected", "Solicitud no aprobada", message);
  if (loan.email) {
    await sendEmail({
      to: loan.email,
      subject: "Solicitud No Aprobada",
      html: loanRejectedTemplate({ name: loan.clientName, loanId: loan.folio, reason: message }),
      text: `Hola ${loan.clientName}, tu solicitud ${loan.folio} no fue aprobada. Motivo: ${message}`,
    }).catch(() => undefined);
  }
  void logActivity("Rechazó solicitud", "Préstamo", loan.folio, `Motivo: ${reasonCode}`);
}

/** Modifica monto, plazo y tasa antes de aprobar (RPC existente). */
export async function modifyTerms(
  loan: Loan,
  terms: { amount: number; installments: number; annualRate: number; monthlyPayment: number; totalToPay: number },
): Promise<void> {
  if (isDemoMode) {
    await wait(300);
    Object.assign(demoLoan(loan.id), {
      amount: terms.amount,
      installments: terms.installments,
      interestRate: terms.annualRate,
      monthlyPayment: terms.monthlyPayment,
      totalToPay: terms.totalToPay,
    });
  } else {
    const { data, error } = await requireSupabase().rpc("admin_modify_loan_terms", {
      p_loan_id: loan.id,
      p_amount: terms.amount,
      p_installments: terms.installments,
      p_interest_rate: terms.annualRate,
      p_monthly_payment: Math.round(terms.monthlyPayment * 100) / 100,
      p_total_to_pay: Math.round(terms.totalToPay * 100) / 100,
    });
    if (error) throw error;
    if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);
  }
  void logActivity("Modificó términos", "Préstamo", loan.folio, `${terms.amount} MXN · ${terms.installments} cuotas`);
}

/* ───────────── Acciones: Firma ───────────── */

export async function resendContract(loan: Loan): Promise<void> {
  if (isDemoMode) await wait(400);
  else await apiFetch("/signnow-remind", { method: "POST", body: JSON.stringify({ loan_id: loan.id }) });
  void logActivity("Reenvió contrato", "Préstamo", loan.folio, "Recordatorio SignNow");
}

/** Vuelve a generar la invitación de SignNow (cuando la anterior falló). */
export async function resendSignatureInvite(loan: Loan): Promise<void> {
  if (isDemoMode) {
    await wait(500);
    demoLoan(loan.id).signatureStatus = "Espera";
  } else {
    const pdf = await generateSchedulePdfBase64(loan);
    const invite = await apiFetch<Record<string, unknown>>("/signnow-invite", {
      method: "POST",
      body: JSON.stringify({
        loan_id: loan.id,
        recipient_email: loan.email,
        optional_pdf_base64: pdf,
        optional_pdf_name: `tabla-amortizacion-${loan.folio}.pdf`,
      }),
    });
    await patchLoanMetadata(loan.id, { signnow_invite: invite, signnow_error: null });
  }
  void logActivity("Generó nueva invitación de firma", "Préstamo", loan.folio, "SignNow");
}

/** Firma asistida: el admin sube el contrato firmado y escaneado. */
export async function attachSignedContract(loan: Loan, file: File, uploaderId: string | null): Promise<void> {
  if (isDemoMode) {
    await wait(500);
    const l = demoLoan(loan.id);
    l.dbStatus = "signed";
    l.stage = "desembolso";
    l.signedAt = new Date().toISOString();
    l.signatureStatus = "Firmado";
  } else {
    const url = await uploadToStorage(loan.userId, file, `contrato-${loan.folio}`);
    const sb = requireSupabase();
    const { error: docErr } = await sb.from("loan_documents").insert({
      loan_id: loan.id,
      type: "contract",
      uploader_id: uploaderId,
      file_url: url,
      file_name: file.name,
      mime_type: file.type,
    });
    if (docErr) throw docErr;
    const { error } = await sb
      .from("loans")
      .update({ status: "signed", signed_at: new Date().toISOString() })
      .eq("id", loan.id);
    if (error) throw error;
  }
  void logActivity("Subió contrato firmado", "Préstamo", loan.folio, file.name);
}

/* ───────────── Acciones: Desembolso ───────────── */

export async function updateDisbursementAccount(loan: Loan, bank: string, clabe: string): Promise<void> {
  if (isDemoMode) {
    await wait(250);
    Object.assign(demoLoan(loan.id), { bank, clabe });
  } else {
    await patchLoanMetadata(loan.id, { depositData: { bank, clabe } });
  }
  void logActivity("Cambió cuenta de desembolso", "Préstamo", loan.folio, `${bankName(bank)} ${maskClabe(clabe)}`);
}

export async function confirmDisbursement(loan: Loan, voucher: File | null, uploaderId: string | null): Promise<void> {
  if (isDemoMode) {
    await wait(600);
    const l = demoLoan(loan.id);
    l.dbStatus = "active";
    l.stage = "activo";
    l.disbursedAt = new Date().toISOString();
    l.disbursementStatus = "Desembolsado";
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    l.nextPaymentDate = next.toISOString();
    demoMovements.unshift({
      id: `mov-${Date.now()}`, date: l.disbursedAt, userId: l.userId, clientName: l.clientName, type: "desembolso_prestamo",
      product: "prestamo", direction: "salida", amount: l.amount, status: "exitoso", provider: "manual", method: "Transferencia SPEI",
      reference: `SPEI-${l.folio}`, description: `Desembolso ${l.folio}`, relatedId: l.id, failedReason: null,
    });
    void logActivity("Registró desembolso", "Préstamo", loan.folio, voucher ? "Voucher adjunto" : "Sin voucher");
    return;
  }
  const sb = requireSupabase();
  let url: string | null = null;
  if (voucher) url = await uploadToStorage(loan.userId, voucher, `voucher-${loan.folio}`);
  const { error: dErr } = await sb.from("loan_disbursements").insert({
    loan_id: loan.id,
    amount: loan.amount,
    destination_account: { bank: loan.bank, clabe: loan.clabe },
  });
  if (dErr) throw dErr;
  if (url) {
    await sb.from("loan_documents").insert({
      loan_id: loan.id,
      type: "voucher",
      uploader_id: uploaderId,
      file_url: url,
      file_name: voucher?.name ?? null,
      mime_type: voucher?.type ?? null,
    });
  }
  await rpcStatus(loan.id, "disburse");
  if (loan.email) {
    await sendEmail({
      to: loan.email,
      subject: "¡Desembolso Exitoso!",
      html: disbursementConfirmedTemplate({
        name: loan.clientName,
        loanId: loan.folio,
        amount: fmtAmount(loan.amount),
        bank: bankName(loan.bank),
        clabe: maskClabe(loan.clabe),
      }),
      text: `Hola ${loan.clientName}, el desembolso de tu préstamo por $${fmtAmount(loan.amount)} MXN fue procesado.`,
    }).catch(() => undefined);
  }
  void logActivity("Registró desembolso", "Préstamo", loan.folio, url ? "Voucher adjunto" : "Sin voucher");
}

/* ───────────── Acciones: Cobranza ───────────── */

/** Aviso de cobranza: correo que informa al cliente que se le hará el cargo. */
export async function sendCollectionNotice(
  loan: Loan,
  opts: { installment: number | null; amount: number; chargeDate: string; extraEmails?: string[] },
  sentBy: string,
): Promise<void> {
  const notice: CollectionNotice = { sentAt: new Date().toISOString(), sentBy, channel: "email", installment: opts.installment };
  if (isDemoMode) {
    await wait(350);
    demoLoan(loan.id).notices.unshift(notice);
  } else {
    const to = [loan.email, ...(opts.extraEmails ?? [])].filter(Boolean);
    await sendEmail({
      to,
      subject: "Aviso de cargo a tu cuenta",
      html: collectionNoticeTemplate({
        name: loan.clientName,
        loanId: loan.folio,
        amount: fmtAmount(opts.amount),
        installment: opts.installment ? `Cuota ${opts.installment} de ${loan.installments}` : "Saldo pendiente",
        chargeDate: opts.chargeDate,
        bank: bankName(loan.bank),
        clabe: maskClabe(loan.clabe),
      }),
      text: `Hola ${loan.clientName}, te informamos que el ${opts.chargeDate} se realizará el cargo de $${fmtAmount(opts.amount)} MXN de tu préstamo ${loan.folio}.`,
    });
    await notify(loan.userId, "collection_notice", "Aviso de cargo", `Se realizará el cargo de tu cuota el ${opts.chargeDate}.`);
    await patchLoanMetadata(loan.id, { collection_notices: [notice, ...loan.notices] });
  }
  void logActivity("Envió aviso de cobranza", "Préstamo", loan.folio, opts.installment ? `Cuota ${opts.installment}` : "Saldo");
}

/**
 * Cobro bajo demanda. Usa el endpoint existente de la API de Increscendo
 * (`POST /belvo/loans/:id/payment-request`). El backend decide el proveedor
 * (Belvo o Druo) según el banco del cliente.
 */
export async function executeCharge(loan: Loan, installmentNumbers: number[]): Promise<{ partial: boolean; created: number }> {
  if (!installmentNumbers.length) throw new Error("Selecciona al menos una cuota.");
  if (isDemoMode) {
    await wait(700);
    for (const n of installmentNumbers) {
      demoMovements.unshift({
        id: `mov-${Date.now()}-${n}`, date: new Date().toISOString(), userId: loan.userId, clientName: loan.clientName,
        type: "cobro_bajo_demanda", product: "prestamo", direction: "entrada", amount: loan.monthlyPayment, status: "en_proceso",
        provider: loan.bank.includes("bbva") ? "druo" : "belvo", method: "Domiciliación", reference: `pr_demo_${n}`,
        description: `Cuota ${n} de ${loan.installments} · ${loan.folio}`, relatedId: loan.id, failedReason: null,
      });
    }
    void logActivity("Ejecutó cobro bajo demanda", "Préstamo", loan.folio, `Cuotas ${installmentNumbers.join(", ")}`);
    return { partial: false, created: installmentNumbers.length };
  }
  const res = await apiFetch<{ partial?: boolean; payment_requests?: unknown[] }>(
    `/belvo/loans/${loan.id}/payment-request`,
    { method: "POST", body: JSON.stringify({ installmentNumbers }) },
  );
  void logActivity("Ejecutó cobro bajo demanda", "Préstamo", loan.folio, `Cuotas ${installmentNumbers.join(", ")}`);
  return { partial: !!res?.partial, created: res?.payment_requests?.length ?? installmentNumbers.length };
}

/** Renueva el consentimiento de domiciliación en Belvo con los documentos vigentes del cliente. */
export async function renewConsent(loan: Loan, docs: { ineFront?: string | null; ineBack?: string | null; selfie?: string | null; contract?: string | null }): Promise<void> {
  if (isDemoMode) {
    await wait(700);
    demoLoan(loan.id).consentStatus = "confirmed";
    void logActivity("Renovó consentimiento", "Préstamo", loan.folio, "Belvo");
    return;
  }
  const form = new FormData();
  form.append("loan_id", loan.id);
  const append = async (url: string | null | undefined, field: string, name: string) => {
    if (!url) return;
    const blob = await (await fetch(url)).blob();
    form.append(field, new File([blob], name, { type: blob.type }), name);
  };
  await append(docs.ineFront, "ine_front", "ine_front.jpg");
  await append(docs.ineBack, "ine_back", "ine_back.jpg");
  await append(docs.selfie, "selfie", "selfie.jpg");
  await append(docs.contract, "contract", "contract.pdf");
  await apiFetch("/belvo/consents/renew", { method: "POST", body: form });
  void logActivity("Renovó consentimiento", "Préstamo", loan.folio, "Belvo");
}

/** Registra venta de cartera (queda como estatus de cierre). */
export async function sellPortfolio(loan: Loan, comment: string, file: File | null): Promise<void> {
  if (isDemoMode) {
    await wait(400);
    demoLoan(loan.id).portfolioSold = true;
  } else {
    const url = file ? await uploadToStorage(loan.userId, file, `venta-cartera-${loan.folio}`) : null;
    await patchLoanMetadata(loan.id, { portfolio_sold: { at: new Date().toISOString(), comment, file_url: url } });
  }
  void logActivity("Registró venta de cartera", "Préstamo", loan.folio, comment);
}

/** Registra un pago recibido fuera de la domiciliación (transferencia o depósito). */
export async function registerExternalPayment(loan: Loan, amount: number, reference: string): Promise<void> {
  if (isDemoMode) {
    await wait(350);
    const l = demoLoan(loan.id);
    l.paidAmount += amount;
    l.paidInstallments = Math.min(l.installments, Math.floor(l.paidAmount / l.monthlyPayment + 0.001));
    l.daysOverdue = 0;
    demoMovements.unshift({
      id: `mov-${Date.now()}`, date: new Date().toISOString(), userId: l.userId, clientName: l.clientName, type: "cobro_bajo_demanda",
      product: "prestamo", direction: "entrada", amount, status: "exitoso", provider: "manual", method: "Pago externo",
      reference, description: `Pago externo · ${l.folio}`, relatedId: l.id, failedReason: null,
    });
  } else {
    const paid = loan.paidAmount + amount;
    const payments = Array.isArray(loan.metadata.external_payments) ? loan.metadata.external_payments : [];
    await patchLoanMetadata(loan.id, {
      paid_amount: paid,
      last_payment_date: new Date().toISOString(),
      external_payments: [...(payments as unknown[]), { amount, reference, at: new Date().toISOString() }],
    });
  }
  void logActivity("Registró pago externo", "Préstamo", loan.folio, `${amount} MXN · ${reference}`);
}
