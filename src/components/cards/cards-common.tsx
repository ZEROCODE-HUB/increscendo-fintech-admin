import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { PermissionGuard } from "@/components/permission-guard";
import { SampleDataNotice } from "@/components/ui-kit";
import type { Resource } from "@/lib/permissions";

/** Encabezado común del módulo Tarjetas (Fase 2, datos de ejemplo hasta la integración con OneCard). */
export function CardsPage({
  title,
  description,
  action,
  recurso = "tarjetas",
  service,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  recurso?: Resource;
  /** Servicio de OneCard que respalda la pantalla (del documento de alcance). */
  service?: string;
  children: ReactNode;
}) {
  return (
    <PermissionGuard recurso={recurso}>
      <PageHeader title={title} description={description} action={action} />
      <SampleDataNotice force>
        Tarjetas · Fase 2. Pantallas listas con datos de ejemplo; se conectan cuando exista la integración vía API con OneCard
        {service ? ` (servicios: ${service})` : ""}.
      </SampleDataNotice>
      {children}
    </PermissionGuard>
  );
}

export const RECIPIENT_LABEL: Record<string, string> = {
  enviada: "Invitación enviada",
  abierta: "Abrió el enlace",
  identidad: "Paso 1 · Identidad",
  membresia: "Paso 2 · Membresía",
  en_revision: "Paso 3 · En revisión",
  aprobada: "Paso 4 · Asignación",
  contrato: "Paso 5 · Contrato",
  lista: "Paso 6 · Lista para recoger",
  activa: "Tarjeta activa",
  rechazada: "Rechazada",
  expirada: "Enlace vencido",
};
