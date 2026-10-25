import { createFileRoute, Outlet } from "@tanstack/react-router";
import { TabLayout, type Tab } from "@/components/tab-layout";
import { PageHeader } from "@/components/page-header";
import { SampleDataNotice } from "@/components/ui-kit";
import { PermissionGuard } from "@/components/permission-guard";
import { useSubscriptions } from "@/hooks/queries";

export const Route = createFileRoute("/admin/membresias/suscripciones")({
  head: () => ({ meta: [{ title: "Suscripciones — Increscendo Fintech" }] }),
  component: Layout,
});

function Layout() {
  const { data = [] } = useSubscriptions();
  const soon = data.filter((s) => s.status === "active" && s.daysToExpire != null && s.daysToExpire >= 0 && s.daysToExpire <= 30).length;
  const pending = data.filter((s) => s.status === "pending").length;
  const tabs: Tab[] = [
    { label: "Todas", to: "/admin/membresias/suscripciones" },
    { label: "Activas", to: "/admin/membresias/suscripciones/activas" },
    { label: `Por vencer${soon ? ` (${soon})` : ""}`, to: "/admin/membresias/suscripciones/por-vencer" },
    { label: "Vencidas", to: "/admin/membresias/suscripciones/vencidas" },
    { label: `Pago pendiente${pending ? ` (${pending})` : ""}`, to: "/admin/membresias/suscripciones/pendientes" },
  ];
  return (
    <PermissionGuard recurso="membresias">
      <PageHeader title="Suscripciones" description="Quién tiene qué plan, vencimientos y renovaciones. La renovación es el ingreso recurrente." />
      <SampleDataNotice />
      <TabLayout tabs={tabs}>
        <Outlet />
      </TabLayout>
    </PermissionGuard>
  );
}
