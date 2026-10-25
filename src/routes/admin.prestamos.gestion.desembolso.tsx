import { createFileRoute } from "@tanstack/react-router";
import { LoansTable } from "@/components/loans/loans-table";

export const Route = createFileRoute("/admin/prestamos/gestion/desembolso")({
  component: () => <LoansTable stage="desembolso" />,
});
