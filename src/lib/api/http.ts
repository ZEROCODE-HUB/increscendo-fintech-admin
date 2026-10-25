import { supabase } from "@/lib/supabase";
import { INCRESCENDO_API_URL } from "@/lib/env";

const DEFAULT_TIMEOUT = 90_000;

function isTokenExpiringSoon(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return Date.now() >= payload.exp * 1000 - 60_000;
  } catch {
    return true;
  }
}

/** Token de la sesión del admin (se renueva si está por vencer). */
export async function getAccessToken(): Promise<string> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data } = await supabase.auth.getSession();
  let token = data.session?.access_token ?? null;
  if (!token || isTokenExpiringSoon(token)) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    token = refreshed.session?.access_token ?? token;
  }
  if (!token) throw new Error("No se encontró una sesión activa. Inicia sesión de nuevo.");
  return token;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/**
 * Llamada autenticada a la API de Increscendo (Belvo, SignNow, Conekta, Tekae).
 * Mismo contrato que `increscendoApiFetch` de la plataforma actual.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { timeout?: number } = {},
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchInit } = init;
  const token = await getAccessToken();
  const url = path.startsWith("http") ? path : `${INCRESCENDO_API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = new Headers(fetchInit.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (fetchInit.body && !(fetchInit.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...fetchInit, headers, signal: controller.signal });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) {
      const errField = body && typeof body === "object" && "error" in body ? (body as { error: unknown }).error : null;
      const msg: string = errField ? String(errField) : `Error ${res.status}`;
      throw new ApiError(msg, res.status, body);
    }
    return body as T;
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new Error("La API de Increscendo tardó demasiado en responder.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Invoca una Edge Function de Supabase (send-email, create-user). */
export async function invokeFunction<T = unknown>(name: string, body: unknown): Promise<T> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> });
  if (error) throw new Error(error.message || `Error en la función ${name}`);
  if (data && typeof data === "object" && "error" in data && (data as { error: unknown }).error) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as T;
}
