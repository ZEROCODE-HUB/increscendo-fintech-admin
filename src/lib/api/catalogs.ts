import { apiFetch } from "./http";
import { isDemoMode, wait } from "./source";
import { DEFAULT_BANKS, DEFAULT_REJECTION_REASONS } from "./catalogs-data";
import { logActivity } from "./activity";
import type { Bank, RejectionReason } from "./types";

/**
 * Catálogos administrables: motivos de rechazo y bancos.
 * Hasta que exista la tabla `catalog_rejection_reasons` se usan los valores
 * por defecto (editables en memoria durante la sesión).
 */
const reasons: RejectionReason[] = DEFAULT_REJECTION_REASONS.map((r) => ({ ...r }));
const banks: Bank[] = DEFAULT_BANKS.map((b) => ({ ...b }));

export async function listRejectionReasons(): Promise<RejectionReason[]> {
  await wait(80);
  return reasons.map((r) => ({ ...r }));
}

export async function saveRejectionReason(r: RejectionReason): Promise<void> {
  await wait(200);
  const i = reasons.findIndex((x) => x.code === r.code);
  if (i >= 0) reasons[i] = r;
  else reasons.push(r);
  void logActivity("Editó motivo de rechazo", "Catálogo", r.code, r.label);
}

/**
 * Bancos: se intenta leer las instituciones soportadas por Belvo
 * (`/belvo/institutions`, el mismo endpoint de la app del cliente) para no
 * mantener la lista a mano. Si falla, se usa el catálogo acordado con Belvo.
 */
export async function listBanks(): Promise<Bank[]> {
  if (!isDemoMode) {
    try {
      const res = await apiFetch<{ results?: Record<string, any>[]; data?: Record<string, any>[] } | Record<string, any>[]>(
        "/belvo/institutions",
      );
      const rows = Array.isArray(res) ? res : res.results ?? res.data ?? [];
      if (rows.length) {
        return rows.map((r) => {
          const id = String(r.id ?? r.name);
          const name = String(r.display_name ?? r.name ?? id);
          return {
            id,
            name,
            provider: /bbva|bancomer/i.test(name) ? "druo" : "belvo",
            source: "belvo",
            active: r.status ? r.status === "healthy" || r.status === "active" : true,
          } as Bank;
        });
      }
    } catch {
      /* se usa el catálogo local */
    }
  }
  await wait(80);
  return banks.map((b) => ({ ...b }));
}

export async function addManualBank(name: string): Promise<void> {
  await wait(150);
  const id = `mx_${name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_")}`;
  banks.push({ id, name, provider: /bbva|bancomer/i.test(name) ? "druo" : "belvo", source: "manual", active: true });
  void logActivity("Agregó banco", "Catálogo", id, `${name} (pendiente validar con Belvo)`);
}
