import { supabase } from "@/lib/supabase";
import { BACKEND_PENDING, wait } from "./source";
import { demoActivity } from "./demo-data";
import type { ActivityEntry } from "./types";

let currentUserName = "Administrador";
export function setActivityUser(name: string) {
  currentUserName = name;
}

/**
 * Registro de actividad del personal (bitácora).
 * Mientras no exista la tabla `backoffice_activity`, se guarda en memoria y la
 * pantalla muestra datos de ejemplo. Contrato en docs/CONTRATOS_BACKEND.md.
 */
export async function logActivity(action: string, entity: string, entityId: string, detail = ""): Promise<void> {
  const entry: ActivityEntry = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    user: currentUserName,
    action,
    entity,
    entityId,
    detail,
  };
  demoActivity.unshift(entry);
  if (!BACKEND_PENDING.activity && supabase) {
    await supabase.from("backoffice_activity").insert({
      user_name: entry.user,
      action,
      entity,
      entity_id: entityId,
      detail,
    });
  }
}

export async function listActivity(): Promise<ActivityEntry[]> {
  if (!BACKEND_PENDING.activity && supabase) {
    const { data, error } = await supabase
      .from("backoffice_activity")
      .select("id, created_at, user_name, action, entity, entity_id, detail")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return ((data ?? []) as Record<string, any>[]).map((r) => ({
      id: r.id,
      at: r.created_at,
      user: r.user_name,
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id,
      detail: r.detail ?? "",
    }));
  }
  await wait(150);
  return [...demoActivity];
}

export async function listEntityActivity(entityId: string): Promise<ActivityEntry[]> {
  const all = await listActivity();
  return all.filter((a) => a.entityId === entityId);
}
