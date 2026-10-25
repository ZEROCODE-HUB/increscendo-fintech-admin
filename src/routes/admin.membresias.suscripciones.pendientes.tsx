import { createFileRoute } from "@tanstack/react-router";
import { SubscriptionsTable } from "@/components/memberships/subscriptions-table";

export const Route = createFileRoute("/admin/membresias/suscripciones/pendientes")({
  component: () => <SubscriptionsTable view="pendientes" />,
});
