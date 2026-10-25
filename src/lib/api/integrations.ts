import { supabase } from "@/lib/supabase";
import { INCRESCENDO_API_URL } from "@/lib/env";
import { isDemoMode, wait } from "./source";
import type { EmailTemplate, IntegrationHealth } from "./types";

const PURPOSE: Record<IntegrationHealth["key"], string> = {
  supabase: "Base de datos y autenticación",
  belvo: "Domiciliación de cuotas (todos los bancos excepto BBVA)",
  druo: "Domiciliación para cuentas BBVA Bancomer",
  conekta: "Cobro de membresías (tarjeta, link, transferencia, efectivo)",
  signnow: "Firma electrónica de contratos",
  tekae: "Pago de servicios, recargas y giftcards",
  onecard: "Tarjetas prepago (Fase 2)",
};

const NAMES: Record<IntegrationHealth["key"], string> = {
  supabase: "Supabase",
  belvo: "Belvo",
  druo: "Druo",
  conekta: "Conekta",
  signnow: "SignNow",
  tekae: "Tekae",
  onecard: "OneCard",
};

async function timed(fn: () => Promise<boolean>): Promise<{ ok: boolean; ms: number }> {
  const t = performance.now();
  try {
    const ok = await fn();
    return { ok, ms: Math.round(performance.now() - t) };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - t) };
  }
}

/**
 * Salud de integraciones con chequeos reales.
 * - Supabase: consulta mínima.
 * - Proveedores: `GET {API}/health/{proveedor}` (endpoint que el backend debe exponer;
 *   mientras no exista, se muestra "Desconocido" en lugar de un falso "En línea").
 */
export async function checkIntegrations(): Promise<IntegrationHealth[]> {
  const keys: IntegrationHealth["key"][] = ["supabase", "belvo", "druo", "conekta", "signnow", "tekae", "onecard"];
  if (isDemoMode) {
    await wait(500);
    const sample: Record<string, [IntegrationHealth["status"], number | null, string]> = {
      supabase: ["sin_configurar", null, "Modo demostración: faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY."],
      belvo: ["ok", 312, "Responde correctamente."],
      druo: ["sin_configurar", null, "Credenciales recibidas; integración vía API pendiente."],
      conekta: ["ok", 228, "Responde correctamente."],
      signnow: ["ok", 405, "Responde correctamente."],
      tekae: ["degradado", 2140, "Tiempo de respuesta alto."],
      onecard: ["sin_configurar", null, "Contrato firmado; integración vía API en Fase 2."],
    };
    return keys.map((k) => ({
      key: k, name: NAMES[k], purpose: PURPOSE[k], status: sample[k][0], latencyMs: sample[k][1],
      checkedAt: new Date().toISOString(), detail: sample[k][2],
    }));
  }
  const results: IntegrationHealth[] = [];
  for (const k of keys) {
    if (k === "supabase") {
      const r = await timed(async () => {
        const { error } = await supabase!.from("app_settings").select("updated_at").limit(1);
        return !error;
      });
      results.push({ key: k, name: NAMES[k], purpose: PURPOSE[k], status: r.ok ? "ok" : "caido", latencyMs: r.ms, checkedAt: new Date().toISOString(), detail: r.ok ? "Consulta correcta." : "No respondió." });
      continue;
    }
    let status: IntegrationHealth["status"] = "desconocido";
    let detail = "El backend aún no expone /health para este proveedor.";
    const r = await timed(async () => {
      const res = await fetch(`${INCRESCENDO_API_URL}/health/${k}`, { method: "GET" });
      if (res.status === 404) return false;
      status = res.ok ? "ok" : "caido";
      detail = res.ok ? "Responde correctamente." : `Error ${res.status}`;
      return res.ok;
    });
    results.push({ key: k, name: NAMES[k], purpose: PURPOSE[k], status, latencyMs: status === "desconocido" ? null : r.ms, checkedAt: new Date().toISOString(), detail });
  }
  return results;
}

/** Plantillas de correo y disparadores (avisos, recordatorios, rechazos). */
export const EMAIL_TEMPLATES: EmailTemplate[] = [
  { key: "loan_approved", name: "Préstamo preaprobado", subject: "¡Préstamo Pre Aprobado!", trigger: "Al aprobar una solicitud", automatic: true, enabled: true },
  { key: "loan_rejected", name: "Solicitud no aprobada", subject: "Solicitud No Aprobada", trigger: "Al rechazar una solicitud (incluye el motivo)", automatic: true, enabled: true },
  { key: "disbursement", name: "Desembolso exitoso", subject: "¡Desembolso Exitoso!", trigger: "Al registrar el desembolso", automatic: true, enabled: true },
  { key: "collection_notice", name: "Aviso de cobranza", subject: "Aviso de cargo a tu cuenta", trigger: "Manual: menú ⋯ › Enviar aviso de cobranza", automatic: false, enabled: true },
  { key: "payment_reminder_d1", name: "Recordatorio: vence mañana", subject: "Tu cuota vence mañana", trigger: "Automático: 1 día antes del vencimiento", automatic: true, enabled: true },
  { key: "payment_reminder_d3", name: "Recordatorio: vence en 3 días", subject: "Tu cuota vence en 3 días", trigger: "Automático: 3 días antes del vencimiento", automatic: true, enabled: false },
  { key: "payment_failed", name: "Cargo no realizado", subject: "No pudimos realizar el cargo", trigger: "Automático: cuando Belvo/Druo rechaza un cargo", automatic: true, enabled: true },
  { key: "kyc_rejected", name: "Revisa tus documentos", subject: "Revisa tus documentos", trigger: "Al rechazar una identidad (mensaje orientador)", automatic: true, enabled: true },
  { key: "membership_expiring", name: "Membresía por vencer", subject: "Tu membresía está por vencer", trigger: "Automático: 7 días antes del vencimiento", automatic: true, enabled: true },
  { key: "card_invitation", name: "Invitación a tarjeta", subject: "Tu tarjeta Increscendo te espera", trigger: "Al lanzar una campaña de tarjetas", automatic: true, enabled: true },
];
