import { requireSupabase } from "@/lib/supabase";
import { apiFetch } from "./http";
import { isDemoMode, wait } from "./source";
import { demoClients, demoCoupons, demoPlans, demoSubscriptions } from "./demo-data";
import { logActivity } from "./activity";
import { sendEmail } from "./email";
import type { Coupon, MembershipPlan, Subscription, SubscriptionStatus } from "./types";

const DAY = 86_400_000;

function daysTo(expires: string | null): number | null {
  if (!expires) return null;
  return Math.round((new Date(expires).getTime() - Date.now()) / DAY);
}

/* ───────────── Suscripciones (user_memberships) ───────────── */

export async function listSubscriptions(): Promise<Subscription[]> {
  if (isDemoMode) {
    await wait();
    return demoSubscriptions.map((s) => ({ ...s, daysToExpire: daysTo(s.expiresAt) }));
  }
  const { data, error } = await requireSupabase()
    .from("user_memberships")
    .select("id, user_id, status, started_at, expires_at, auto_renew, created_at, membership_plan_id, membership_plans(name, price), users(first_name, last_name, email)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, any>[]).map((m) => ({
    id: m.id,
    userId: m.user_id,
    clientName: `${m.users?.first_name ?? ""} ${m.users?.last_name ?? ""}`.trim() || (m.users?.email ?? "—"),
    email: m.users?.email ?? "",
    planId: m.membership_plan_id,
    planName: m.membership_plans?.name ?? "—",
    price: Number(m.membership_plans?.price ?? 0),
    status: m.status as SubscriptionStatus,
    startedAt: m.started_at ?? m.created_at,
    expiresAt: m.expires_at,
    autoRenew: !!m.auto_renew,
    daysToExpire: daysTo(m.expires_at),
  }));
}

export async function listClientSubscriptions(userId: string): Promise<Subscription[]> {
  const all = await listSubscriptions();
  return all.filter((s) => s.userId === userId);
}

/** Asigna una membresía manualmente (p. ej. pago recibido por transferencia o efectivo). */
export async function assignMembership(userId: string, planId: string, startDate: string): Promise<void> {
  const plan = (await listPlans(true)).find((p) => p.id === planId);
  if (!plan) throw new Error("Plan no encontrado");
  const start = new Date(startDate);
  const expires = new Date(start.getTime() + plan.durationDays * DAY);
  if (isDemoMode) {
    await wait(300);
    const c = demoClients.find((x) => x.id === userId);
    const sub: Subscription = {
      id: `sub-${Date.now()}`,
      userId,
      clientName: c?.fullName ?? "—",
      email: c?.email ?? "",
      planId,
      planName: plan.name,
      price: plan.price,
      status: "active",
      startedAt: start.toISOString(),
      expiresAt: expires.toISOString(),
      autoRenew: false,
      daysToExpire: daysTo(expires.toISOString()),
    };
    demoSubscriptions.unshift(sub);
    if (c) c.membership = { id: sub.id, planId, planName: plan.name, status: "active", startedAt: sub.startedAt, expiresAt: sub.expiresAt };
  } else {
    const { error } = await requireSupabase().from("user_memberships").insert({
      user_id: userId,
      membership_plan_id: planId,
      status: "active",
      started_at: start.toISOString(),
      expires_at: expires.toISOString(),
    });
    if (error) throw error;
  }
  void logActivity("Asignó membresía", "Cliente", userId, plan.name);
}

export async function setSubscriptionStatus(sub: Subscription, status: SubscriptionStatus): Promise<void> {
  if (isDemoMode) {
    await wait(250);
    const s = demoSubscriptions.find((x) => x.id === sub.id);
    if (s) s.status = status;
    const c = demoClients.find((x) => x.id === sub.userId);
    if (c?.membership?.id === sub.id) c.membership.status = status;
  } else {
    const { error } = await requireSupabase().from("user_memberships").update({ status }).eq("id", sub.id);
    if (error) throw error;
  }
  void logActivity(status === "expired" ? "Venció membresía" : status === "cancelled" ? "Canceló membresía" : "Cambió estatus de membresía", "Membresía", sub.id, `${sub.clientName} · ${sub.planName}`);
}

/** Recordatorio de renovación por correo. */
export async function sendRenewalReminder(sub: Subscription): Promise<void> {
  const when = sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString("es-MX") : "próximamente";
  await sendEmail({
    to: sub.email,
    subject: "Tu membresía está por vencer",
    html: `<p>Hola <strong>${sub.clientName}</strong>,</p><p>Tu membresía <strong>${sub.planName}</strong> vence el ${when}. Renuévala para seguir disfrutando tus beneficios.</p>`,
    text: `Hola ${sub.clientName}, tu membresía ${sub.planName} vence el ${when}.`,
  });
  void logActivity("Envió recordatorio de renovación", "Membresía", sub.id, sub.clientName);
}

/* ───────────── Planes (membership_plans) ───────────── */

function mapPlan(p: Record<string, any>): MembershipPlan {
  const f = (p.features ?? {}) as Record<string, any>;
  return {
    id: p.id,
    name: p.name,
    price: Number(p.price ?? 0),
    currency: p.currency ?? "MXN",
    durationDays: Number(p.duration_days ?? 365),
    active: p.active !== false,
    benefits: Array.isArray(f.benefits) ? f.benefits : [],
    targetAudience: f.targetAudience ?? "",
    interestRate: f.interestRate != null ? Number(f.interestRate) : null,
    includesCard: f.includesCard === true,
  };
}

export async function listPlans(includeInactive = true): Promise<MembershipPlan[]> {
  if (isDemoMode) {
    await wait(150);
    return demoPlans.filter((p) => includeInactive || p.active).map((p) => ({ ...p }));
  }
  let q = requireSupabase().from("membership_plans").select("*").order("price", { ascending: true });
  if (!includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as Record<string, any>[]).map(mapPlan);
}

export type PlanInput = {
  name: string;
  price: number;
  interval: "week" | "month" | "year";
  frequency: number;
  benefits: string[];
  targetAudience: string;
  interestRate: number | null;
  includesCard: boolean;
};

const durationDays = (i: PlanInput) => (i.interval === "year" ? 365 : i.interval === "week" ? 7 : 30) * i.frequency;

export async function savePlan(input: PlanInput, existing?: MembershipPlan): Promise<void> {
  const features = {
    benefits: input.benefits,
    targetAudience: input.targetAudience,
    interestRate: input.interestRate,
    includesCard: input.includesCard,
  };
  if (isDemoMode) {
    await wait(300);
    if (existing) {
      Object.assign(demoPlans.find((p) => p.id === existing.id) ?? {}, {
        name: input.name, price: input.price, durationDays: durationDays(input), benefits: input.benefits,
        targetAudience: input.targetAudience, interestRate: input.interestRate, includesCard: input.includesCard,
      });
    } else {
      demoPlans.push({
        id: `plan-${Date.now()}`, name: input.name, price: input.price, currency: "MXN", durationDays: durationDays(input),
        active: true, benefits: input.benefits, targetAudience: input.targetAudience, interestRate: input.interestRate,
        includesCard: input.includesCard,
      });
    }
  } else if (existing) {
    const { error } = await requireSupabase()
      .from("membership_plans")
      .update({ name: input.name, price: input.price, currency: "MXN", duration_days: durationDays(input), features })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    // Alta en Conekta + base, igual que el admin actual.
    await apiFetch("/conekta-plans", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        amount: input.price,
        currency: "MXN",
        interval: input.interval,
        frequency: input.frequency,
        description: input.targetAudience,
        features,
        active: true,
      }),
    });
  }
  void logActivity(existing ? "Editó plan" : "Creó plan", "Membresía", input.name, input.benefits.join(", "));
}

export async function togglePlan(plan: MembershipPlan): Promise<void> {
  if (isDemoMode) {
    await wait(200);
    const p = demoPlans.find((x) => x.id === plan.id);
    if (p) p.active = !p.active;
  } else {
    const { error } = await requireSupabase().from("membership_plans").update({ active: !plan.active }).eq("id", plan.id);
    if (error) throw error;
  }
  void logActivity(plan.active ? "Desactivó plan" : "Activó plan", "Membresía", plan.name);
}

/* ───────────── Cupones (coupons) ───────────── */

function mapCoupon(c: Record<string, any>): Coupon {
  return {
    id: c.id,
    code: c.code,
    discountPercent: c.discount_percent != null ? Number(c.discount_percent) : null,
    discountAmount: c.discount_amount != null ? Number(c.discount_amount) : null,
    active: c.active !== false,
    maxRedemptions: c.max_redemptions != null ? Number(c.max_redemptions) : null,
    redeemedCount: Number(c.redeemed_count ?? 0),
    startsAt: c.starts_at ?? null,
    endsAt: c.ends_at ?? null,
  };
}

export async function listCoupons(): Promise<Coupon[]> {
  if (isDemoMode) {
    await wait(150);
    return demoCoupons.map((c) => ({ ...c }));
  }
  const { data, error } = await requireSupabase().from("coupons").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, any>[]).map(mapCoupon);
}

export type CouponInput = {
  code: string;
  type: "percent" | "amount";
  value: number;
  maxRedemptions: number | null;
  startsAt: string | null;
  endsAt: string | null;
};

export async function saveCoupon(input: CouponInput, existing?: Coupon): Promise<void> {
  const payload = {
    code: input.code.toUpperCase().trim(),
    discount_percent: input.type === "percent" ? input.value : null,
    discount_amount: input.type === "amount" ? input.value : null,
    max_redemptions: input.maxRedemptions,
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
  };
  if (isDemoMode) {
    await wait(250);
    const mapped = mapCoupon({ ...payload, id: existing?.id ?? `cp-${Date.now()}`, active: existing?.active ?? true, redeemed_count: existing?.redeemedCount ?? 0 });
    const idx = demoCoupons.findIndex((c) => c.id === existing?.id);
    if (idx >= 0) demoCoupons[idx] = mapped;
    else demoCoupons.unshift(mapped);
  } else if (existing) {
    const { error } = await requireSupabase().from("coupons").update(payload).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await requireSupabase().from("coupons").insert([{ ...payload, active: true }]);
    if (error) throw error;
  }
  void logActivity(existing ? "Editó cupón" : "Creó cupón", "Cupón", payload.code);
}

export async function toggleCoupon(c: Coupon): Promise<void> {
  if (isDemoMode) {
    await wait(150);
    const x = demoCoupons.find((k) => k.id === c.id);
    if (x) x.active = !x.active;
  } else {
    const { error } = await requireSupabase().from("coupons").update({ active: !c.active }).eq("id", c.id);
    if (error) throw error;
  }
  void logActivity(c.active ? "Desactivó cupón" : "Activó cupón", "Cupón", c.code);
}

export async function deleteCoupon(c: Coupon): Promise<void> {
  if (isDemoMode) {
    await wait(150);
    const i = demoCoupons.findIndex((k) => k.id === c.id);
    if (i >= 0) demoCoupons.splice(i, 1);
  } else {
    const { error } = await requireSupabase().from("coupons").delete().eq("id", c.id);
    if (error) throw error;
  }
  void logActivity("Eliminó cupón", "Cupón", c.code);
}
