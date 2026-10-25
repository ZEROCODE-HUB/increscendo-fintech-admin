/**
 * Configuración leída de variables de entorno del build (Vite).
 * Convención Vite: solo `VITE_*` queda accesible en el bundle. No usar para secretos.
 *
 * Las claves de Supabase se leen directo en `supabase.ts`.
 */

const apiUrlRaw = import.meta.env.VITE_INCRESCENDO_API_URL as string | undefined;

/**
 * API de Increscendo (`increscendo-api`): Belvo, SignNow, Conekta, Tekae.
 * Es la misma que usa hoy la plataforma del cliente.
 */
export const INCRESCENDO_API_URL: string = (apiUrlRaw ?? "https://increscendo-api.vercel.app").replace(
  /\/+$/,
  "",
);

/** Bucket de Supabase Storage donde viven INE, CURP, contratos y vouchers. */
export const STORAGE_BUCKET: string =
  (import.meta.env.VITE_STORAGE_BUCKET as string | undefined) ?? "documents";

/** App del cliente (para enlaces en correos). */
export const CLIENT_APP_URL: string = (
  (import.meta.env.VITE_CLIENT_APP_URL as string | undefined) ?? "https://increscendofintech.com"
).replace(/\/+$/, "");

export const env = { INCRESCENDO_API_URL, STORAGE_BUCKET, CLIENT_APP_URL };
