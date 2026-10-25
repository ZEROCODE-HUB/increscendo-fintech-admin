import { createFileRoute, Outlet } from "@tanstack/react-router";
import { TabLayout, type Tab } from "@/components/tab-layout";
import { PageHeader } from "@/components/page-header";
import { SampleDataNotice } from "@/components/ui-kit";
import { PermissionGuard } from "@/components/permission-guard";
import { useLoans } from "@/hooks/queries";
import type { LoanStage } from "@/lib/api/types";

export const Route = createFileRoute("/admin/prestamos/gestion")({
  head: () => ({ meta: [{ title: "Préstamos — Increscendo Fintech" }] }),
  component: GestionLayout,
});

function GestionLayout() {
  const { data = [] } = useLoans();
  const n = (s: LoanStage) => data.filter((l) => l.stage === s).length;
  const label = (t: string, c: number) => (c ? `${t} (${c})` : t);
  const tabs: Tab[] = [
    { label: label("Todos", data.length), to: "/admin/prestamos/gestion" },
    { label: label("Solicitudes", n("solicitud")), to: "/admin/prestamos/gestion/solicitudes" },
    { label: label("Firma", n("firma")), to: "/admin/prestamos/gestion/firma" },
    { label: label("Desembolso", n("desembolso")), to: "/admin/prestamos/gestion/desembolso" },
    { label: label("Activos", n("activo")), to: "/admin/prestamos/gestion/activos" },
    { label: "Cerrados", to: "/admin/prestamos/gestion/cerrados" },
  ];
  return (
    <PermissionGuard recurso="prestamos">
      <PageHeader
        title="Gestión de préstamos"
        description="Toda la cartera en una vista y una pestaña por etapa. Las acciones de cada préstamo están en el menú ⋯."
      />
      <SampleDataNotice />
      <TabLayout tabs={tabs}>
        <Outlet />
      </TabLayout>
    </PermissionGuard>
  );
}
