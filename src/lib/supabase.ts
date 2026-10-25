import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const isSupabaseConfigured = supabase !== null;

/**
 * Devuelve el cliente de Supabase o lanza un error claro si no está configurado.
 * Usar esto en las capas de acceso a datos para no operar contra `null` en silencio.
 */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el entorno.",
    );
  }
  return supabase;
}

/**
 * Errores de Postgres/Supabase que indican falta de permiso por RLS (o política).
 * Se diferencian de un resultado vacío legítimo para que la UI pueda mostrar
 * "no tienes permiso para ver esto" en lugar de "no hay datos".
 */
const PERMISSION_PATTERNS: RegExp[] = [
  /permission denied/i,
  /insufficient privilege/i,
  /row-level security/i,
  /new row violates row-level security/i,
  /42501/,
];

export type SupabaseDataError = {
  code: string | null;
  message: string;
  details?: string | null;
  hint?: string | null;
};

export function toDataError(err: unknown): SupabaseDataError {
  if (err && typeof err === "object" && "message" in err) {
    const e = err as {
      code?: string | null;
      message?: string;
      details?: string | null;
      hint?: string | null;
    };
    return {
      code: e.code ?? null,
      message: e.message ?? "Error desconocido",
      details: e.details ?? null,
      hint: e.hint ?? null,
    };
  }
  return { code: null, message: String(err) };
}

export function isPermissionError(err: unknown): boolean {
  const e = toDataError(err);
  if (e.code === "42501") return true;
  return PERMISSION_PATTERNS.some((p) => p.test(e.message));
}

export function isNotConfiguredError(err: unknown): boolean {
  return /Supabase no está configurado/i.test(toDataError(err).message);
}

const ERROR_MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, "Usuario o contraseña incorrectos."],
  [/email not confirmed/i, "El correo aún no está confirmado. Revisa tu bandeja de entrada."],
  [/user not found/i, "No existe una cuenta con ese correo."],
  [
    /too many requests|rate limit/i,
    "Demasiados intentos fallidos. Espera unos minutos y vuelve a intentarlo.",
  ],
  [/invalid email/i, "Ingresa un correo electrónico válido."],
  [
    /network|fetch failed|failed to fetch/i,
    "No se pudo conectar. Verifica tu conexión e inténtalo de nuevo.",
  ],
];

export function getAuthErrorMessage(message: string): string {
  for (const [pattern, friendly] of ERROR_MESSAGES) {
    if (pattern.test(message)) return friendly;
  }
  return "No se pudo iniciar sesión. Inténtalo nuevamente.";
}
