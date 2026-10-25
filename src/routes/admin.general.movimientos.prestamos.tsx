import { createFileRoute } from "@tanstack/react-router";
import { MovementsTable } from "@/components/movements/movements-table";

export const Route = createFileRoute("/admin/general/movimientos/prestamos")({
  component: () => <MovementsTable view="prestamo" />,
});
