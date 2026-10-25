import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { PermissionGuard } from "@/components/permission-guard";
import { SampleDataNotice } from "@/components/ui-kit";
import { ActivityTable } from "@/components/activity-table";

export const Route = createFileRoute("/admin/administracion/registros")({
  head: () => ({ meta: [{ title: "Registros — Increscendo Fintech" }] }),
  component: () => (
    <PermissionGuard recurso="registros">
      <PageHeader title="Registros" description="Bitácora completa: quién hizo qué, cuándo y sobre qué registro." />
      <SampleDataNotice force>
        La bitácora se guarda de forma permanente cuando el backend cree la tabla <code>backoffice_activity</code>. Hoy se registra durante la sesión.
      </SampleDataNotice>
      <ActivityTable />
    </PermissionGuard>
  ),
});
