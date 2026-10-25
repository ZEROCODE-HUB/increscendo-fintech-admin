import { createFileRoute } from "@tanstack/react-router";
import { CollectionTable } from "@/components/loans/loans-table";

export const Route = createFileRoute("/admin/prestamos/cobranza/")({
  component: () => <CollectionTable view="atrasados" />,
});
