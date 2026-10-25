import { requireSupabase } from "@/lib/supabase";
import { isDemoMode, usesSampleData, wait } from "./source";
import { demoBackoffice, demoClients } from "./demo-data";
import { logActivity } from "./activity";
import type { BackofficeRole, BackofficeUser, Client } from "./types";

/**
 * Usuarios del backoffice.
 * Hoy en la base solo existe `users.role = 'admin'`. Los roles nuevos
 * (operaciones, agente, cobranza, lectura, técnico) se guardan en
 * `users.metadata.backoffice_role` hasta que exista la tabla de roles.
 */
export async function listBackofficeUsers(): Promise<BackofficeUser[]> {
  if (isDemoMode) {
    await wait();
    return demoBackoffice.map((b) => ({
      ...b,
      clientsRegistered: demoClients.filter((c) => c.executiveId === b.id).length,
    }));
  }
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("users")
    .select("id, email, first_name, last_name, role, metadata, updated_at")
    .or("role.eq.admin,metadata->>backoffice_role.not.is.null");
  if (error) throw error;
  const { data: clients } = await sb.from("users").select("metadata").eq("role", "client");
  const counts = new Map<string, number>();
  for (const c of (clients ?? []) as { metadata: Record<string, unknown> | null }[]) {
    const ex = c.metadata?.executive_id as string | undefined;
    if (ex) counts.set(ex, (counts.get(ex) ?? 0) + 1);
  }
  return ((data ?? []) as Record<string, any>[]).map((u) => ({
    id: u.id,
    name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email,
    email: u.email,
    role: (u.metadata?.backoffice_role as BackofficeRole) ?? "admin",
    active: u.metadata?.backoffice_active !== false,
    location: u.metadata?.backoffice_location ?? null,
    lastAccessAt: u.updated_at ?? null,
    clientsRegistered: counts.get(u.id) ?? 0,
  }));
}

export async function updateBackofficeUser(
  user: BackofficeUser,
  patch: Partial<Pick<BackofficeUser, "role" | "active" | "location">>,
): Promise<void> {
  if (isDemoMode) {
    await wait(250);
    Object.assign(demoBackoffice.find((b) => b.id === user.id) ?? {}, patch);
  } else {
    const sb = requireSupabase();
    const { data } = await sb.from("users").select("metadata").eq("id", user.id).single();
    const meta = { ...((data?.metadata as Record<string, unknown>) ?? {}) };
    if (patch.role) meta.backoffice_role = patch.role;
    if (patch.active !== undefined) meta.backoffice_active = patch.active;
    if (patch.location !== undefined) meta.backoffice_location = patch.location;
    const { error } = await sb.from("users").update({ metadata: meta }).eq("id", user.id);
    if (error) throw error;
  }
  void logActivity("Editó usuario backoffice", "Usuario backoffice", user.name, JSON.stringify(patch));
}

export async function inviteBackofficeUser(input: { name: string; email: string; role: BackofficeRole; location: string }): Promise<void> {
  if (isDemoMode || usesSampleData("roles")) {
    await wait(400);
    demoBackoffice.push({
      id: `bo-${Date.now()}`,
      name: input.name,
      email: input.email,
      role: input.role,
      active: true,
      location: input.location || null,
      lastAccessAt: null,
      clientsRegistered: 0,
    });
  }
  void logActivity("Invitó usuario backoffice", "Usuario backoffice", input.email, input.role);
}

export type ExecutiveSummary = {
  id: string;
  name: string;
  location: string | null;
  clients: number;
  last30: number;
  withMembership: number;
  withLoan: number;
};

export function summarizeExecutives(users: BackofficeUser[], clients: Client[]): ExecutiveSummary[] {
  const since = Date.now() - 30 * 86_400_000;
  return users
    .filter((u) => u.role === "agente" || clients.some((c) => c.executiveId === u.id))
    .map((u) => {
      const own = clients.filter((c) => c.executiveId === u.id);
      return {
        id: u.id,
        name: u.name,
        location: u.location,
        clients: own.length,
        last30: own.filter((c) => new Date(c.createdAt).getTime() >= since).length,
        withMembership: own.filter((c) => c.membership?.status === "active").length,
        withLoan: own.filter((c) => c.loansTotal > 0).length,
      };
    })
    .sort((a, b) => b.clients - a.clients);
}
