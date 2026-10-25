import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Megaphone } from "lucide-react";
import { TabLayout } from "@/components/tab-layout";
import { WizardModal } from "@/components/wizard-modal";
import { FileDropzone } from "@/components/file-dropzone";
import { BtnPrimary, Input } from "@/components/portal-shell";
import { FieldLabel, InfoNote } from "@/components/ui-kit";
import { CardsPage } from "@/components/cards/cards-common";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { useRefreshAll } from "@/hooks/queries";
import { launchCampaign, parseRecipientsFile, type CampaignDraftRow } from "@/lib/api/cards";

export const Route = createFileRoute("/admin/tarjetas/campanas")({
  head: () => ({ meta: [{ title: "Campañas de tarjetas — Increscendo Fintech" }] }),
  component: Layout,
});

function NewCampaign({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const refresh = useRefreshAll();
  const [name, setName] = useState("");
  const [rows, setRows] = useState<CampaignDraftRow[]>([]);
  const [busy, setBusy] = useState(false);
  const valid = rows.filter((r) => r.valid);
  return (
    <WizardModal
      open
      onClose={onClose}
      title="Nueva campaña de invitación"
      finishLabel={busy ? "Enviando…" : `Enviar ${valid.length} invitaciones`}
      finishDisabled={busy || !name.trim() || !valid.length}
      onFinish={async () => {
        setBusy(true);
        try {
          await launchCampaign(name.trim(), rows, profile?.fullName ?? "Administrador");
          toast.success(`Campaña lanzada: ${valid.length} invitaciones enviadas.`);
          onClose();
          await refresh();
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
      steps={[
        {
          label: "Destinatarios",
          content: (
            <div className="space-y-4">
              <div>
                <FieldLabel>Nombre de la campaña</FieldLabel>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Socios Premium — Puebla" />
              </div>
              <div>
                <FieldLabel hint="(columnas: nombre, correo, teléfono)">Excel o CSV de destinatarios</FieldLabel>
                <FileDropzone
                  accept=".xlsx,.xls,.csv"
                  onFile={async (f) => {
                    if (!f) return setRows([]);
                    try {
                      setRows(await parseRecipientsFile(f));
                    } catch {
                      toast.error("No se pudo leer el archivo.");
                    }
                  }}
                />
              </div>
              <InfoNote>Cada destinatario recibe un enlace propio, vigente 30 días, que lo lleva al paso que le corresponde.</InfoNote>
            </div>
          ),
        },
        {
          label: "Revisión",
          content: (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>{valid.length}</strong> válidos · <strong>{rows.length - valid.length}</strong> con error
              </p>
              <div className="border rounded-lg max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Nombre</th>
                      <th className="px-3 py-2 text-left">Correo</th>
                      <th className="px-3 py-2 text-left">Teléfono</th>
                      <th className="px-3 py-2 text-left">Validación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                          Sube un archivo en el paso anterior.
                        </td>
                      </tr>
                    )}
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-1.5">{r.name}</td>
                        <td className="px-3 py-1.5">{r.email}</td>
                        <td className="px-3 py-1.5">{r.phone}</td>
                        <td className={`px-3 py-1.5 text-xs ${r.valid ? "text-emerald-700" : "text-red-600"}`}>{r.valid ? "OK" : r.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ),
        },
      ]}
    />
  );
}

function Layout() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <CardsPage
      title="Campañas"
      description="Invitaciones masivas a la tarjeta: sube el Excel, lanza los correos y sigue el avance de cada destinatario."
      action={
        can(profile?.role, "tarjetas", "editar") && (
          <BtnPrimary type="button" onClick={() => setOpen(true)}>
            <Megaphone size={16} /> Nueva campaña
          </BtnPrimary>
        )
      }
    >
      <TabLayout
        tabs={[
          { label: "Campañas", to: "/admin/tarjetas/campanas" },
          { label: "Destinatarios", to: "/admin/tarjetas/campanas/destinatarios" },
        ]}
      >
        <Outlet />
      </TabLayout>
      {open && <NewCampaign onClose={() => setOpen(false)} />}
    </CardsPage>
  );
}
