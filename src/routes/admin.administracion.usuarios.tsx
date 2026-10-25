import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { TabLayout } from "@/components/tab-layout";
import { PageHeader } from "@/components/page-header";
import { PermissionGuard } from "@/components/permission-guard";
import { FormDialog } from "@/components/form-dialog";
import { BtnPrimary, Input } from "@/components/portal-shell";
import { FieldLabel, SampleDataNotice, Select } from "@/components/ui-kit";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/roles";
import { inviteBackofficeUser } from "@/lib/api/backoffice";
import { useRefreshAll } from "@/hooks/queries";
import type { BackofficeRole } from "@/lib/api/types";

export const Route = createFileRoute("/admin/administracion/usuarios")({
  head: () => ({ meta: [{ title: "Usuarios backoffice — Increscendo Fintech" }] }),
  component: Layout,
});

function InviteDialog({ onClose }: { onClose: () => void }) {
  const refresh = useRefreshAll();
  const [v, setV] = useState({ name: "", email: "", role: "agente" as BackofficeRole, location: "" });
  const [busy, setBusy] = useState(false);
  return (
    <FormDialog
      open
      onClose={onClose}
      title="Invitar usuario del equipo"
      submitLabel="Enviar invitación"
      isSubmitting={busy}
      onSubmit={async () => {
        if (!v.name.trim() || !v.email.includes("@")) return;
        setBusy(true);
        try {
          await inviteBackofficeUser(v);
          toast.success("Invitación enviada.");
          onClose();
          await refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <FieldLabel>Nombre</FieldLabel>
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </div>
      <div>
        <FieldLabel>Correo</FieldLabel>
        <Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
      </div>
      <div>
        <FieldLabel>Rol</FieldLabel>
        <Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as BackofficeRole })}>
          {(Object.keys(ROLE_LABEL) as BackofficeRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground mt-1">{ROLE_DESCRIPTION[v.role]}</p>
      </div>
      <div>
        <FieldLabel hint="(opcional)">Plaza</FieldLabel>
        <Input value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} placeholder="Puebla" />
      </div>
    </FormDialog>
  );
}

function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <PermissionGuard recurso="backoffice">
      <PageHeader
        title="Usuarios backoffice"
        description="Personal con acceso al panel, sus roles y lo que hace cada uno."
        action={
          <BtnPrimary type="button" onClick={() => setOpen(true)}>
            <UserPlus size={16} /> Invitar usuario
          </BtnPrimary>
        }
      />
      <SampleDataNotice force>
        Roles nuevos (operaciones, agente, cobranza…) se guardan en <code>users.metadata.backoffice_role</code> hasta que exista la tabla de roles.
        La invitación de usuarios requiere la Edge Function de alta del backend.
      </SampleDataNotice>
      <TabLayout
        tabs={[
          { label: "Usuarios", to: "/admin/administracion/usuarios" },
          { label: "Roles y permisos", to: "/admin/administracion/usuarios/roles" },
          { label: "Ejecutivos", to: "/admin/administracion/usuarios/ejecutivos" },
          { label: "Actividad", to: "/admin/administracion/usuarios/actividad" },
        ]}
      >
        <Outlet />
      </TabLayout>
      {open && <InviteDialog onClose={() => setOpen(false)} />}
    </PermissionGuard>
  );
}
