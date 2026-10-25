import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { PermissionGuard } from "@/components/permission-guard";
import { Badge } from "@/components/portal-shell";
import { InfoNote, SampleDataNotice, SectionCard } from "@/components/ui-kit";
import { EMAIL_TEMPLATES } from "@/lib/api/integrations";
import { logActivity } from "@/lib/api/activity";

export const Route = createFileRoute("/admin/sistema/notificaciones")({
  head: () => ({ meta: [{ title: "Notificaciones — Increscendo Fintech" }] }),
  component: Notificaciones,
});

function Notificaciones() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(Object.fromEntries(EMAIL_TEMPLATES.map((t) => [t.key, t.enabled])));
  return (
    <PermissionGuard recurso="sistema">
      <PageHeader title="Notificaciones" description="Correos que recibe el cliente y cuándo se envían." />
      <SampleDataNotice force>
        Los correos manuales (aviso de cobranza, rechazos) ya se envían desde el panel. Los automáticos (recordatorios antes del vencimiento,
        cargo no realizado, membresía por vencer) los dispara el backend con una tarea programada; aquí solo se encienden o apagan.
      </SampleDataNotice>
      <SectionCard title="Plantillas">
        <div className="divide-y">
          {EMAIL_TEMPLATES.map((t) => (
            <div key={t.key} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{t.name}</span>
                  <Badge tone={t.automatic ? "info" : "neutral"}>{t.automatic ? "Automático" : "Manual"}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Asunto: “{t.subject}” · {t.trigger}
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={enabled[t.key]}
                  onChange={(e) => {
                    setEnabled((p) => ({ ...p, [t.key]: e.target.checked }));
                    void logActivity(e.target.checked ? "Activó notificación" : "Desactivó notificación", "Notificación", t.key, t.name);
                    toast.success(`${t.name}: ${e.target.checked ? "activada" : "desactivada"}.`);
                  }}
                />
                {enabled[t.key] ? "Activa" : "Inactiva"}
              </label>
            </div>
          ))}
        </div>
      </SectionCard>
      <div className="mt-4">
        <InfoNote>Los correos llevan al cliente a su app (no al admin). El remitente y el diseño se mantienen iguales a los actuales de Increscendo.</InfoNote>
      </div>
    </PermissionGuard>
  );
}
