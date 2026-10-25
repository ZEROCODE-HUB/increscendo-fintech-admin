import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Modo demostración: si el build no tiene VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY,
 * todo el panel funciona con datos de ejemplo (útil para revisar la interfaz).
 */
export const isDemoMode = !isSupabaseConfigured;

/**
 * Secciones que aún no tienen tabla/endpoint en el backend de Increscendo.
 * Con Supabase configurado, estas secciones siguen mostrando datos de ejemplo
 * (con una etiqueta visible) hasta que el backend implemente el contrato.
 * Ver docs/CONTRATOS_BACKEND.md.
 */
export const BACKEND_PENDING = {
  roles: true,
  activity: true,
  cards: true,
  campaigns: true,
  catalogs: true,
  integrationsHealth: true,
  emailTemplates: true,
} as const;

export type PendingKey = keyof typeof BACKEND_PENDING;

export function usesSampleData(key: PendingKey): boolean {
  return isDemoMode || BACKEND_PENDING[key];
}

export const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
