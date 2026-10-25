import type { Bank, RejectionReason } from "./types";

/**
 * Catálogo de motivos de rechazo.
 * Cada motivo trae el mensaje orientador que verá el cliente y los códigos de
 * Belvo que se traducen a él. Se edita en Sistema › Catálogos.
 */
export const DEFAULT_REJECTION_REASONS: RejectionReason[] = [
  {
    code: "INE_ILEGIBLE",
    label: "INE ilegible",
    clientMessage:
      "Tu INE no se ve legible. Vuelve a tomar la foto con buena luz, sin reflejos ni brillos, y verifica que se lean todos los datos.",
    appliesTo: ["identidad", "prestamo", "tarjeta"],
    belvoCodes: ["document_invalid"],
  },
  {
    code: "INE_INCOMPLETA",
    label: "Falta frente o reverso de la INE",
    clientMessage: "Necesitamos el frente y el reverso de tu INE. Sube ambas caras para continuar.",
    appliesTo: ["identidad", "prestamo", "tarjeta"],
    belvoCodes: [],
  },
  {
    code: "INE_VENCIDA",
    label: "INE vencida",
    clientMessage: "Tu INE está vencida. Sube una identificación vigente para continuar.",
    appliesTo: ["identidad", "prestamo", "tarjeta"],
    belvoCodes: [],
  },
  {
    code: "DATOS_NO_COINCIDEN",
    label: "Datos no coinciden con la INE",
    clientMessage:
      "Los datos que capturaste no coinciden con tu INE. Revisa que tu nombre y apellidos estén escritos igual que en tu identificación.",
    appliesTo: ["identidad", "prestamo", "tarjeta"],
    belvoCodes: [],
  },
  {
    code: "RFC_INVALIDO",
    label: "RFC inválido",
    clientMessage: "Tu RFC no es válido. Verifica que tenga 13 caracteres y coincida con tus datos.",
    appliesTo: ["identidad", "prestamo", "tarjeta"],
    belvoCodes: [],
  },
  {
    code: "CUENTA_INVALIDA",
    label: "Cuenta bancaria inválida",
    clientMessage:
      "No pudimos validar tu cuenta bancaria. Verifica que la CLABE de 18 dígitos sea correcta y esté a tu nombre.",
    appliesTo: ["prestamo"],
    belvoCodes: ["account_invalid"],
  },
  {
    code: "CONSENTIMIENTO",
    label: "Autorización de cargos no confirmada",
    clientMessage:
      "No se confirmó la autorización de cargos a tu cuenta. Revisa tu correo y confirma la autorización para continuar.",
    appliesTo: ["prestamo"],
    belvoCodes: ["consent_not_confirmed"],
  },
  {
    code: "RIESGO",
    label: "No cumple políticas de riesgo",
    clientMessage: "Por ahora no podemos aprobar tu solicitud. Podrás intentarlo de nuevo más adelante.",
    appliesTo: ["prestamo", "tarjeta"],
    belvoCodes: ["high_risk", "high_risk_institution", "customer_blocked"],
  },
  {
    code: "LIMITE",
    label: "Límite de transacción excedido",
    clientMessage: "El monto supera el límite permitido por tu banco. Intenta con un monto menor.",
    appliesTo: ["prestamo"],
    belvoCodes: ["transaction_limits_exceeded"],
  },
  {
    code: "SIN_MEMBRESIA",
    label: "Sin membresía activa",
    clientMessage: "Necesitas una membresía activa para solicitar este producto.",
    appliesTo: ["prestamo", "tarjeta"],
    belvoCodes: [],
  },
  {
    code: "OTRO",
    label: "Otro motivo",
    clientMessage: "Tu solicitud necesita una revisión adicional. Nuestro equipo se pondrá en contacto contigo.",
    appliesTo: ["identidad", "prestamo", "tarjeta"],
    belvoCodes: [],
  },
];

/**
 * Catálogo de bancos (el mismo que usa hoy la plataforma, acordado con Belvo).
 * BBVA se cobra por Druo; el resto por Belvo.
 * Héctor indicará los bancos faltantes (mencionó Cobalto y otros) para validarlos con Belvo.
 */
export const DEFAULT_BANKS: Bank[] = [
  ["mx_afirme", "Banca Afirme"],
  ["mx_alianza", "Alianza"],
  ["mx_america", "Bank of America"],
  ["mx_amex", "American Express Bank"],
  ["mx_amigo", "Banco Amigo"],
  ["mx_azteca", "Banco Azteca"],
  ["mx_bajio", "Banco del Bajío"],
  ["mx_bancoppel", "Bancoppel"],
  ["mx_banjercito", "Banjercito"],
  ["mx_banorte", "Banorte"],
  ["mx_banxico", "Banco de México"],
  ["mx_bbva_bancomer", "BBVA"],
  ["mx_ci", "CI Banco"],
  ["mx_citi_banamex", "Citi Banamex"],
  ["mx_compartamos", "Banco Compartamos"],
  ["mx_famsa", "Banco Ahorro Famsa"],
  ["mx_fundacion_donde", "Fundación Dondé"],
  ["mx_hsbc", "HSBC"],
  ["mx_inbursa", "Banco Inbursa"],
  ["mx_ing", "ING MX"],
  ["mx_interacciones", "Banco Interacciones"],
  ["mx_intercam", "Intercam Banco"],
  ["mx_invex", "Banco Invex"],
  ["mx_ixe", "IXE Banco"],
  ["mx_mercantil_norte", "Banco Mercantil del Norte"],
  ["mx_mifel", "Banco Mifel"],
  ["mx_monterrey_regional", "Monterrey Regional"],
  ["mx_multiva", "Banco Multiva"],
  ["mx_nacional_ejercito", "Banco Nacional del Ejército"],
  ["mx_regional_monterrey", "Banco Regional de Monterrey"],
  ["mx_santander", "Santander"],
  ["mx_scotiabank", "Scotiabank"],
  ["mx_scotiabank_inverlat", "Scotiabank Inverlat"],
  ["mx_revolut", "Revolut"],
].map(([id, name]) => ({
  id,
  name,
  provider: id === "mx_bbva_bancomer" ? "druo" : "belvo",
  source: "belvo",
  active: true,
})) as Bank[];

export function bankName(idOrName: string | null | undefined): string {
  if (!idOrName) return "—";
  return DEFAULT_BANKS.find((b) => b.id === idOrName)?.name ?? idOrName;
}

/** Proveedor de domiciliación según el banco (regla de Héctor: Bancomer → Druo). */
export function providerForBank(idOrName: string | null | undefined): "belvo" | "druo" | null {
  if (!idOrName) return null;
  const s = idOrName.toLowerCase();
  return s.includes("bbva") || s.includes("bancomer") ? "druo" : "belvo";
}
