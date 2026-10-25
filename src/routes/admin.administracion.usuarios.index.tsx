import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Power, ShieldCheck } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { ActionsDropdown } from "@/components/actions-dropdown";
import { FormDialog } from "@/components/form-dialog";
import { Badge } from "@/components/portal-shell";
import { Select } from "@/components/ui-kit";
import { useBackofficeUsers, useRefreshAll } from "@/hooks/queries";
import { updateBackofficeUser } from "@/lib/api/backoffice";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/roles";
import { dateTime } from "@/lib/format";
import type { BackofficeRole, BackofficeUser } from "@/lib/api/types";

export const Route = createFileRoute("/admin/administracion/usuarios/")({
  component: Users,
});

type Row = BackofficeUser & { roleLabel: string; statusLabel: string };

function RoleDialog({ user, onClose }: { user: BackofficeUser; onClose: () => void }) {
  const refresh = useRefreshAll();
  const [role, setRole] = useState<BackofficeRole>(user.role);
  return (
    <FormDialog
      open
      onClose={onClose}
      title="Cambiar rol"
      description={user.name}
      submitLabel="Guardar"
      onSubmit={async () => {
        await updateBackofficeUser(user, { role });
        toast.success("Rol actualizado.");
        onClose();
        await refresh();
      }}
    >
      <Select value={role} onChange={(e) => setRole(e.target.value as BackofficeRole)}>
        {(Object.keys(ROLE_LABEL) as BackofficeRole[]).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </Select>
      <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTION[role]}</p>
    </FormDialog>
  );
}

function Users() {
  const { data = [], isLoading } = useBackofficeUsers();
  const refresh = useRefreshAll();
  const [editing, setEditing] = useState<BackofficeUser | null>(null);
  const rows: Row[] = data.map((u) => ({ ...u, roleLabel: ROLE_LABEL[u.role], statusLabel: u.active ? "Activo" : "Inactivo" }));
  const cols: Column<Row>[] = [
    { key: "name", label: "Nombre", filterable: true, sortable: true, minWidth: 180, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "email", label: "Correo", filterable: true, minWidth: 220, render: (r) => r.email },
    { key: "roleLabel", label: "Rol", filterable: "enum", filterOptions: Object.values(ROLE_LABEL), minWidth: 140, render: (r) => <Badge tone="info">{r.roleLabel}</Badge> },
    { key: "location", label: "Plaza", minWidth: 100, render: (r) => r.location ?? "—" },
    { key: "clientsRegistered", label: "Clientes dados de alta", sortable: true, minWidth: 130, render: (r) => r.clientsRegistered },
    { key: "statusLabel", label: "Estatus", filterable: "enum", filterOptions: ["Activo", "Inactivo"], minWidth: 90, render: (r) => <Badge tone={r.active ? "success" : "neutral"}>{r.statusLabel}</Badge> },
    { key: "lastAccessAt", label: "Último acceso", minWidth: 130, render: (r) => dateTime(r.lastAccessAt) },
  ];
  return (
    <>
      <DataTable
        columns={cols}
        data={rows}
        loading={isLoading}
        keyExtractor={(r) => r.id}
        actions={(r) => (
          <ActionsDropdown
            actions={[
              { label: "Cambiar rol", icon: ShieldCheck, onClick: () => setEditing(r) },
              {
                label: r.active ? "Desactivar acceso" : "Reactivar acceso",
                icon: Power,
                variant: r.active ? "danger" : "default",
                onClick: async () => {
                  await updateBackofficeUser(r, { active: !r.active });
                  toast.success(r.active ? "Acceso desactivado." : "Acceso reactivado.");
                  await refresh();
                },
              },
            ]}
          />
        )}
      />
      {editing && <RoleDialog user={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
