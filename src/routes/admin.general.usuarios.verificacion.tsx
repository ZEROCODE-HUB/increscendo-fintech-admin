import { createFileRoute } from "@tanstack/react-router";
import { ClientsTable } from "@/components/clients/clients-table";

export const Route = createFileRoute("/admin/general/usuarios/verificacion")({
  component: () => <ClientsTable filter="por_verificar" />,
});
