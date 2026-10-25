import { createFileRoute } from "@tanstack/react-router";
import { ActivityTable } from "@/components/activity-table";

export const Route = createFileRoute("/admin/administracion/usuarios/actividad")({
  component: () => <ActivityTable />,
});
