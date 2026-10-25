import { supabase, requireSupabase } from "@/lib/supabase";
import { STORAGE_BUCKET } from "@/lib/env";
import { apiFetch, invokeFunction } from "./http";
import { isDemoMode, wait } from "./source";
import { demoBackoffice, demoBankAccounts, demoClients, demoSubscriptions } from "./demo-data";
import { providerForBank } from "./catalogs-data";
import { logActivity } from "./activity";
import type {
  AddressParts,
  BankAccount,
  Client,
  ClientDocuments,
  KycReview,
  KycStatus,
  PersonType,
  SubscriptionStatus,
} from "./types";

/* ───────────── Mapeo desde la tabla `users` ───────────── */

const USER_FIELDS =
  "id, code, role, email, first_name, last_name, phone, phone_country_code, address, birth_date, rfc, curp, ine_key, created_at, avatar_url, ine_front_url, ine_back_url, curp_url, selfie_url, contract_url, metadata";

type UserRow = Record<string, unknown> & { id: string; metadata?: Record<string, unknown> | null };

function deriveKyc(row: UserRow): KycReview {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const stored = meta.kyc as KycReview | undefined;
  if (stored?.status) return stored;
  // Sin revisión guardada: se deriva de los documentos cargados.
  const hasIne = !!row.ine_front_url && !!row.ine_back_url;
  return { status: hasIne ? "por_verificar" : "incompleto" };
}

export function mapUser(
  row: UserRow,
  extras: {
    membership?: Client["membership"];
    loansTotal?: number;
    loansActive?: number;
    bank?: string | null;
    executives?: Map<string, string>;
  } = {},
): Client {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const first = String(row.first_name ?? "");
  const last = String(row.last_name ?? "");
  const executiveId = (meta.executive_id as string | undefined) ?? null;
  return {
    id: row.id,
    code: String(row.code ?? ""),
    personType: ((meta.person_type as PersonType) ?? "fisica") as PersonType,
    firstName: first,
    lastName: last,
    fullName: `${first} ${last}`.trim() || String(row.email ?? ""),
    email: String(row.email ?? ""),
    phone: [row.phone_country_code, row.phone].filter(Boolean).join(" "),
    rfc: String(row.rfc ?? meta.rfc ?? ""),
    curp: String(row.curp ?? ""),
    ineKey: String(row.ine_key ?? ""),
    birthDate: (row.birth_date as string) ?? null,
    address: String(row.address ?? ""),
    addressParts: (meta.address_parts as AddressParts) ?? {},
    createdAt: String(row.created_at ?? ""),
    avatarUrl: (row.avatar_url as string) ?? null,
    documents: {
      ineFrontUrl: (row.ine_front_url as string) ?? null,
      ineBackUrl: (row.ine_back_url as string) ?? null,
      curpUrl: (row.curp_url as string) ?? null,
      selfieUrl: (row.selfie_url as string) ?? null,
      contractUrl: (row.contract_url as string) ?? null,
      rfcUrl: (meta.rfc_url as string) ?? null,
      addressProofUrl: (meta.address_proof_url as string) ?? null,
    },
    kyc: deriveKyc(row),
    executiveId,
    executiveName: (meta.executive_name as string) ?? (executiveId ? extras.executives?.get(executiveId) ?? null : null),
    loanEligible: meta.loan_eligible === true || (extras.loansTotal ?? 0) > 0,
    collectionProvider: providerForBank(extras.bank ?? null),
    membership: extras.membership ?? null,
    loansTotal: extras.loansTotal ?? 0,
    loansActive: extras.loansActive ?? 0,
    hasCard: meta.has_card === true,
  };
}

/* ───────────── Consultas ───────────── */

export async function listClients(): Promise<Client[]> {
  if (isDemoMode) {
    await wait();
    return demoClients.map((c) => ({ ...c }));
  }
  const sb = requireSupabase();
  const [{ data: users, error }, { data: subs }, { data: loans }, { data: pms }] = await Promise.all([
    sb.from("users").select(USER_FIELDS).eq("role", "client").order("created_at", { ascending: false }),
    sb.from("user_memberships").select("id, user_id, status, started_at, expires_at, membership_plan_id, membership_plans(name)").order("created_at", { ascending: false }),
    sb.from("loans").select("user_id, status"),
    sb.from("payment_methods").select("user_id, bank_name, is_default, clabe"),
  ]);
  if (error) throw error;

  const subByUser = new Map<string, Client["membership"]>();
  for (const s of (subs ?? []) as Record<string, any>[]) {
    if (subByUser.has(s.user_id)) continue;
    subByUser.set(s.user_id, {
      id: s.id,
      planId: s.membership_plan_id,
      planName: s.membership_plans?.name ?? "",
      status: s.status as SubscriptionStatus,
      startedAt: s.started_at,
      expiresAt: s.expires_at,
    });
  }
  const loanCounts = new Map<string, { total: number; active: number }>();
  for (const l of (loans ?? []) as { user_id: string; status: string }[]) {
    const c = loanCounts.get(l.user_id) ?? { total: 0, active: 0 };
    c.total += 1;
    if (l.status === "active") c.active += 1;
    loanCounts.set(l.user_id, c);
  }
  const bankByUser = new Map<string, string>();
  for (const p of (pms ?? []) as Record<string, any>[]) {
    if (!p.clabe) continue;
    if (!bankByUser.has(p.user_id) || p.is_default) bankByUser.set(p.user_id, p.bank_name);
  }
  return ((users ?? []) as UserRow[]).map((u) =>
    mapUser(u, {
      membership: subByUser.get(u.id) ?? null,
      loansTotal: loanCounts.get(u.id)?.total ?? 0,
      loansActive: loanCounts.get(u.id)?.active ?? 0,
      bank: bankByUser.get(u.id) ?? null,
    }),
  );
}

export async function getClient(id: string): Promise<Client | null> {
  if (isDemoMode) {
    await wait(150);
    const c = demoClients.find((x) => x.id === id);
    return c ? { ...c } : null;
  }
  const all = await listClients();
  return all.find((c) => c.id === id) ?? null;
}

export async function listBankAccounts(userId: string): Promise<BankAccount[]> {
  if (isDemoMode) {
    await wait(120);
    return demoBankAccounts(userId);
  }
  const { data, error } = await requireSupabase()
    .from("payment_methods")
    .select("id, bank_name, clabe, last_digits, validation_status, is_default, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, any>[]).map((p) => ({
    id: p.id,
    bankName: p.bank_name ?? (p.clabe ? "Cuenta bancaria" : "Tarjeta"),
    clabe: p.clabe ?? "",
    lastDigits: p.last_digits ?? (p.clabe ? String(p.clabe).slice(-4) : ""),
    validationStatus: p.validation_status ?? "pending",
    isDefault: !!p.is_default,
    provider: p.clabe ? providerForBank(p.bank_name) : null,
    createdAt: p.created_at,
    kind: p.clabe ? "cuenta" : "tarjeta",
  }));
}

/* ───────────── Escrituras ───────────── */

async function patchUserMetadata(userId: string, patch: Record<string, unknown>) {
  const sb = requireSupabase();
  const { data, error } = await sb.from("users").select("metadata").eq("id", userId).single();
  if (error) throw error;
  const next = { ...((data?.metadata as Record<string, unknown>) ?? {}), ...patch };
  const { error: upErr } = await sb.from("users").update({ metadata: next }).eq("id", userId);
  if (upErr) throw upErr;
}

export type ClientPatch = Partial<{
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  rfc: string;
  curp: string;
  ineKey: string;
  birthDate: string | null;
  addressParts: AddressParts;
  personType: PersonType;
  executiveId: string | null;
  loanEligible: boolean;
}>;

export function composeAddress(p: AddressParts): string {
  return [
    [p.calle, p.numero].filter(Boolean).join(" "),
    p.colonia ? `Col. ${p.colonia}` : "",
    p.ciudad,
    p.estado,
    p.cp ? `CP ${p.cp}` : "",
    p.pais && p.pais !== "México" ? p.pais : "",
  ]
    .filter(Boolean)
    .join(", ");
}

export async function updateClient(id: string, patch: ClientPatch): Promise<void> {
  if (isDemoMode) {
    await wait(200);
    const c = demoClients.find((x) => x.id === id);
    if (!c) return;
    Object.assign(c, {
      ...(patch.firstName !== undefined && { firstName: patch.firstName }),
      ...(patch.lastName !== undefined && { lastName: patch.lastName }),
      ...(patch.email !== undefined && { email: patch.email }),
      ...(patch.phone !== undefined && { phone: patch.phone }),
      ...(patch.rfc !== undefined && { rfc: patch.rfc }),
      ...(patch.curp !== undefined && { curp: patch.curp }),
      ...(patch.ineKey !== undefined && { ineKey: patch.ineKey }),
      ...(patch.birthDate !== undefined && { birthDate: patch.birthDate }),
      ...(patch.personType !== undefined && { personType: patch.personType }),
      ...(patch.loanEligible !== undefined && { loanEligible: patch.loanEligible }),
    });
    if (patch.addressParts) {
      c.addressParts = patch.addressParts;
      c.address = composeAddress(patch.addressParts);
    }
    if (patch.executiveId !== undefined) {
      c.executiveId = patch.executiveId;
      c.executiveName = demoBackoffice.find((b) => b.id === patch.executiveId)?.name ?? null;
    }
    c.fullName = `${c.firstName} ${c.lastName}`.trim();
    void logActivity("Editó datos del cliente", "Cliente", c.code, Object.keys(patch).join(", "));
    return;
  }
  const cols: Record<string, unknown> = {};
  if (patch.firstName !== undefined) cols.first_name = patch.firstName;
  if (patch.lastName !== undefined) cols.last_name = patch.lastName;
  if (patch.email !== undefined) cols.email = patch.email;
  if (patch.phone !== undefined) cols.phone = patch.phone;
  if (patch.rfc !== undefined) cols.rfc = patch.rfc.toUpperCase();
  if (patch.curp !== undefined) cols.curp = patch.curp.toUpperCase();
  if (patch.ineKey !== undefined) cols.ine_key = patch.ineKey.toUpperCase();
  if (patch.birthDate !== undefined) cols.birth_date = patch.birthDate || null;
  if (patch.addressParts) cols.address = composeAddress(patch.addressParts);
  if (Object.keys(cols).length) {
    const { error } = await requireSupabase().from("users").update(cols).eq("id", id);
    if (error) throw error;
  }
  const meta: Record<string, unknown> = {};
  if (patch.addressParts) meta.address_parts = patch.addressParts;
  if (patch.personType) meta.person_type = patch.personType;
  if (patch.executiveId !== undefined) meta.executive_id = patch.executiveId;
  if (patch.loanEligible !== undefined) meta.loan_eligible = patch.loanEligible;
  if (Object.keys(meta).length) await patchUserMetadata(id, meta);
  void logActivity("Editó datos del cliente", "Cliente", id, Object.keys(patch).join(", "));
}

/** Revisión de identidad a nivel cliente (la heredan tarjeta y préstamo). */
export async function reviewIdentity(
  id: string,
  decision: { status: Extract<KycStatus, "verificado" | "rechazado">; reasonCode?: string; reasonMessage?: string },
  reviewer: string,
): Promise<void> {
  const review: KycReview = {
    status: decision.status,
    reasonCode: decision.reasonCode ?? null,
    reasonMessage: decision.reasonMessage ?? null,
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewer,
  };
  if (isDemoMode) {
    await wait(250);
    const c = demoClients.find((x) => x.id === id);
    if (c) c.kyc = review;
  } else {
    await patchUserMetadata(id, { kyc: review });
    if (supabase && decision.status === "rechazado") {
      // Notificación in-app con el mensaje orientador (la app del cliente ya lee `notifications`).
      await supabase.from("notifications").insert({
        user_id: id,
        type: "kyc_rejected",
        title: "Revisa tus documentos",
        message: decision.reasonMessage ?? "Tus documentos necesitan una corrección.",
        url: "/mi-cuenta",
        channels: ["email"],
      });
    }
  }
  void logActivity(
    decision.status === "verificado" ? "Aprobó identidad" : "Rechazó identidad",
    "Cliente",
    id,
    decision.reasonCode ? `Motivo: ${decision.reasonCode}` : "Documentos verificados",
  );
}

export type DocumentKey = keyof ClientDocuments;

const DOC_COLUMN: Partial<Record<DocumentKey, string>> = {
  ineFrontUrl: "ine_front_url",
  ineBackUrl: "ine_back_url",
  curpUrl: "curp_url",
  selfieUrl: "selfie_url",
  contractUrl: "contract_url",
};
const DOC_META: Partial<Record<DocumentKey, string>> = {
  rfcUrl: "rfc_url",
  addressProofUrl: "address_proof_url",
};

export async function uploadToStorage(userId: string, file: File, prefix: string): Promise<string> {
  const sb = requireSupabase();
  const ext = file.name.split(".").pop() || "bin";
  const path = `${userId}/${prefix}_${Date.now()}.${ext}`;
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  return sb.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** El admin sube o reemplaza un documento en nombre del cliente. */
export async function uploadClientDocument(userId: string, key: DocumentKey, file: File): Promise<string> {
  if (isDemoMode) {
    await wait(400);
    const url = URL.createObjectURL(file);
    const c = demoClients.find((x) => x.id === userId);
    if (c) {
      c.documents = { ...c.documents, [key]: url };
      if (c.kyc.status === "incompleto" && c.documents.ineFrontUrl && c.documents.ineBackUrl) c.kyc = { status: "por_verificar" };
    }
    return url;
  }
  const url = await uploadToStorage(userId, file, key.replace("Url", ""));
  const col = DOC_COLUMN[key];
  if (col) {
    const { error } = await requireSupabase().from("users").update({ [col]: url }).eq("id", userId);
    if (error) throw error;
  } else if (DOC_META[key]) {
    await patchUserMetadata(userId, { [DOC_META[key] as string]: url });
  }
  void logActivity("Subió documento", "Cliente", userId, key);
  return url;
}

export type NewClientInput = {
  personType: PersonType;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  rfc: string;
  curp: string;
  ineKey: string;
  birthDate: string;
  addressParts: AddressParts;
  executiveId: string | null;
  loanEligible: boolean;
  files: Partial<Record<DocumentKey, File | null>>;
  /** Firma del contrato de membresía en el alta asistida. */
  contractMode: "signnow" | "escaneado" | "despues";
  planId: string | null;
};

/**
 * Alta asistida: el admin o un agente registra al cliente por él.
 * Usa la Edge Function `create-user` que ya usa el admin actual.
 */
export async function createClient(input: NewClientInput, createdBy: string): Promise<Client & { contractWarning?: string }> {
  if (isDemoMode) {
    await wait(600);
    const id = `cli-${String(demoClients.length + 1).padStart(3, "0")}`;
    const exec = demoBackoffice.find((b) => b.id === input.executiveId);
    const docs: ClientDocuments = {};
    for (const [k, f] of Object.entries(input.files)) if (f) docs[k as DocumentKey] = URL.createObjectURL(f);
    const client: Client = {
      id,
      code: `INC${String(demoClients.length + 1).padStart(3, "0")}`,
      personType: input.personType,
      firstName: input.firstName,
      lastName: input.lastName,
      fullName: `${input.firstName} ${input.lastName}`.trim(),
      email: input.email,
      phone: input.phone,
      rfc: input.rfc.toUpperCase(),
      curp: input.curp.toUpperCase(),
      ineKey: input.ineKey.toUpperCase(),
      birthDate: input.birthDate || null,
      address: composeAddress(input.addressParts),
      addressParts: input.addressParts,
      createdAt: new Date().toISOString(),
      documents: docs,
      kyc: { status: docs.ineFrontUrl && docs.ineBackUrl ? "por_verificar" : "incompleto" },
      executiveId: exec?.id ?? null,
      executiveName: exec?.name ?? null,
      loanEligible: input.loanEligible,
      collectionProvider: null,
      membership: null,
      loansTotal: 0,
      loansActive: 0,
      hasCard: false,
    };
    demoClients.unshift(client);
    if (input.planId) {
      const plan = (await import("./demo-data")).demoPlans.find((p) => p.id === input.planId);
      if (plan) {
        const sub = {
          id: `sub-${Date.now()}`,
          userId: id,
          clientName: client.fullName,
          email: client.email,
          planId: plan.id,
          planName: plan.name,
          price: plan.price,
          status: "pending" as const,
          startedAt: null,
          expiresAt: null,
          autoRenew: false,
          daysToExpire: null,
        };
        demoSubscriptions.unshift(sub);
        client.membership = { id: sub.id, planId: plan.id, planName: plan.name, status: "pending", startedAt: null, expiresAt: null };
      }
    }
    void logActivity("Dio de alta cliente", "Cliente", client.code, `Alta asistida por ${createdBy}`);
    return client;
  }

  const res = await invokeFunction<Record<string, any>>("create-user", {
    email: input.email,
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
    address: composeAddress(input.addressParts),
    birth_date: input.birthDate || null,
    curp: input.curp.toUpperCase(),
    ine_key: input.ineKey.toUpperCase(),
    rfc: input.rfc.toUpperCase(),
    role: "client",
  });
  const profile = res.profile || res.user || res.data?.profile || {};
  const userId: string = profile.id || res.user?.id;
  if (!userId) throw new Error("La función create-user no devolvió el id del usuario.");

  await updateClient(userId, {
    rfc: input.rfc,
    addressParts: input.addressParts,
    personType: input.personType,
    executiveId: input.executiveId,
    loanEligible: input.loanEligible,
  });
  for (const [k, f] of Object.entries(input.files)) {
    if (f) await uploadClientDocument(userId, k as DocumentKey, f);
  }
  await patchUserMetadata(userId, { created_by: createdBy, contract_mode: input.contractMode });
  let contractWarning: string | undefined;
  if (input.contractMode === "signnow") {
    // Contrato de membresía por SignNow (endpoint nuevo; ver docs/CONTRATOS_BACKEND.md).
    try {
      await apiFetch("/signnow-membership-invite", {
        method: "POST",
        body: JSON.stringify({ user_id: userId, recipient_email: input.email, membership_plan_id: input.planId }),
      });
    } catch (e) {
      contractWarning = `No se pudo enviar el contrato por SignNow: ${(e as Error).message}`;
    }
  }
  void logActivity("Dio de alta cliente", "Cliente", userId, `Alta asistida por ${createdBy}`);
  const created = await getClient(userId);
  if (!created) throw new Error("No se pudo leer el cliente recién creado.");
  return { ...created, contractWarning };
}
