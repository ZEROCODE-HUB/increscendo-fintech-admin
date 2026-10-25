import { createFileRoute } from "@tanstack/react-router";
import { ClientsTable } from "@/components/clients/clients-table";

export const Route = createFileRoute("/admin/general/usuarios/morales")({
  component: () => <ClientsTable filter="moral" />,
});
