import { createFileRoute, Outlet } from "@tanstack/react-router";
import { TabLayout, type Tab } from "@/components/tab-layout";
import { PageHeader } from "@/components/page-header";
import { SampleDataNotice } from "@/components/ui-kit";
import { PermissionGuard } from "@/components/permission-guard";
import { FEATURE_CARDS, FEATURE_TEKAE_MOVEMENTS } from "@/lib/feature-flags";

export const Route = createFileRoute("/admin/general/movimientos")({
  head: () => ({ meta: [{ title: "Movimientos — Increscendo Fintech" }] }),
  component: Layout,
});

function Layout() {
  const tabs: Tab[] = [
    { label: "Todos", to: "/admin/general/movimientos" },
    { label: "Membresías", to: "/admin/general/movimientos/membresias" },
    { label: "Préstamos", to: "/admin/general/movimientos/prestamos" },
    ...(FEATURE_CARDS ? [{ label: "Tarjetas", to: "/admin/general/movimientos/tarjetas" }] : []),
    ...(FEATURE_TEKAE_MOVEMENTS ? [{ label: "Servicios", to: "/admin/general/movimientos/servicios" }] : []),
  ];
  return (
    <PermissionGuard recurso="movimientos">
      <PageHeader
        title="Movimientos"
        description="Registro único de cada peso que entra o sale: membresías (Conekta), desembolsos, cuotas y cobros (Belvo/Druo)."
      />
      <SampleDataNotice />
      <TabLayout tabs={tabs}>
        <Outlet />
      </TabLayout>
    </PermissionGuard>
  );
}
