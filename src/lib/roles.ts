import type { BackofficeRole } from "@/lib/api/types";

export const ROLE_LABEL: Record<BackofficeRole, string> = {
  admin: "Administrador",
  operaciones: "Operaciones",
  agente: "Agente comercial",
  cobranza: "Cobranza",
  lectura: "Solo lectura",
  tecnico: "Técnico",
};

export const ROLE_DESCRIPTION: Record<BackofficeRole, string> = {
  admin: "Acceso total al panel, incluida la configuración y los usuarios del backoffice.",
  operaciones: "Revisa identidades, aprueba préstamos y tarjetas, registra desembolsos. Sin configuración.",
  agente: "Da de alta clientes y ve solo los suyos. Puede generar reportes de sus altas. Sin cargos ni cobranzas.",
  cobranza: "Gestiona cobranza: avisos, cobros bajo demanda y seguimiento de cuotas atrasadas.",
  lectura: "Puede ver todo el panel sin modificar nada.",
  tecnico: "Acceso a Operaciones de OneCard e Integraciones para soporte técnico.",
};

