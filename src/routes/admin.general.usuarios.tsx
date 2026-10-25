import { createFileRoute, Outlet } from "@tanstack/react-router";
import { TabLayout, type Tab } from "@/components/tab-layout";
import { PageHeader } from "@/components/page-header";
import { NewClientButton } from "@/components/clients/client-dialogs";
import { SampleDataNotice } from "@/components/ui-kit";
import { PermissionGuard } from "@/components/permission-guard";
import { useClients } from "@/hooks/queries";

export const Route = createFileRoute("/admin/general/usuarios")({
  head: () => ({ meta: [{ title: "Usuarios — Increscendo Fintech" }] }),
  component: UsuariosLayout,
});

function UsuariosLayout() {
  const { data = [] } = useClients();
  const pending = data.filter((c) => c.kyc.status === "por_verificar").length;
  const tabs: Tab[] = [
    { label: "Personas físicas", to: "/admin/general/usuarios" },
    { label: "Personas morales", to: "/admin/general/usuarios/morales" },
    { label: `Identidad por verificar${pending ? ` (${pending})` : ""}`, to: "/admin/general/usuarios/verificacion" },
  ];
  return (
    <PermissionGuard recurso="clientes">
      <PageHeader
        title="Usuarios"
        description="Clientes de Increscendo con su identidad, membresía, préstamos y tarjetas."
        action={<NewClientButton />}
      />
      <SampleDataNotice />
      <TabLayout tabs={tabs}>
        <Outlet />
      </TabLayout>
    </PermissionGuard>
  );
}
