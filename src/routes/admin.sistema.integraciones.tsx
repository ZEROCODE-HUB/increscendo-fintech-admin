import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { PermissionGuard } from "@/components/permission-guard";
import { Badge, BtnOutline, type BadgeTone } from "@/components/portal-shell";
import { InfoNote, SectionCard } from "@/components/ui-kit";
import { useIntegrations } from "@/hooks/queries";
import { dateTime } from "@/lib/format";
import { FEATURE_CARDS, FEATURE_DRUO } from "@/lib/feature-flags";
import type { IntegrationHealth } from "@/lib/api/types";

export const Route = createFileRoute("/admin/sistema/integraciones")({
  head: () => ({ meta: [{ title: "Integraciones — Increscendo Fintech" }] }),
  component: Integraciones,
});

const STATUS: Record<IntegrationHealth["status"], [string, BadgeTone]> = {
  ok: ["En línea", "success"],
  degradado: ["Lento", "warn"],
  caido: ["Sin respuesta", "danger"],
  sin_configurar: ["Pendiente", "neutral"],
  desconocido: ["Desconocido", "neutral"],
};

function Integraciones() {
  const { data = [], isFetching } = useIntegrations();
  const qc = useQueryClient();
  const visible = data.filter((d) => (d.key !== "druo" || FEATURE_DRUO) && (d.key !== "onecard" || FEATURE_CARDS));
  return (
    <PermissionGuard recurso="sistema">
      <PageHeader
        title="Integraciones"
        description="Estado real de cada proveedor y reglas de enrutamiento de pagos."
        action={
          <BtnOutline type="button" onClick={() => qc.invalidateQueries({ queryKey: ["integrations"] })} disabled={isFetching}>
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} /> Verificar ahora
          </BtnOutline>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
        {visible.map((i) => {
          const [label, tone] = STATUS[i.status];
          return (
            <div key={i.key} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{i.name}</div>
                  <div className="text-xs text-muted-foreground">{i.purpose}</div>
                </div>
                <Badge tone={tone}>{label}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-3">{i.detail}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {i.latencyMs != null ? `${i.latencyMs} ms · ` : ""}
                {i.checkedAt ? `verificado ${dateTime(i.checkedAt)}` : ""}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title="Enrutamiento de domiciliación" description="Qué proveedor cobra las cuotas según el banco del cliente.">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b">
                <td className="py-2">BBVA Bancomer</td>
                <td className="py-2 text-right font-semibold">{FEATURE_DRUO ? "Druo" : "Belvo (Druo pendiente)"}</td>
              </tr>
              <tr>
                <td className="py-2">Todos los demás bancos</td>
                <td className="py-2 text-right font-semibold">Belvo</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-3">
            <InfoNote>El cliente solo elige “Bancomer” u “otros bancos”; no ve el proveedor. El backend aplica esta regla al crear la autorización y cada cargo.</InfoNote>
          </div>
        </SectionCard>
        <SectionCard title="Cobro de membresías" description="Pasarela principal y respaldo automático.">
          <ol className="text-sm space-y-2 list-decimal pl-5">
            <li>
              Se intenta con <strong>Conekta</strong> (tarjeta, link de pago, transferencia o efectivo).
            </li>
            <li>
              Si Conekta rechaza (p. ej. tarjeta internacional), se reintenta automáticamente con la <strong>pasarela de respaldo</strong> sin que el
              cliente lo note. Máximo dos proveedores.
            </li>
          </ol>
          <div className="mt-3">
            <InfoNote>Proveedor de respaldo por confirmar (en proceso de alta). Los pagos de ambos aparecen en Movimientos con su proveedor.</InfoNote>
          </div>
        </SectionCard>
      </div>
    </PermissionGuard>
  );
}
