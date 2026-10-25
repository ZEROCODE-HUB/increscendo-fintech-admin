import { createFileRoute, Outlet } from "@tanstack/react-router";
import { TabLayout, type Tab } from "@/components/tab-layout";
import { PageHeader } from "@/components/page-header";
import { SampleDataNotice } from "@/components/ui-kit";
import { PermissionGuard } from "@/components/permission-guard";
import { useLoans } from "@/hooks/queries";
import { money } from "@/lib/format";
import { agingBucket } from "@/lib/loans/status";

export const Route = createFileRoute("/admin/prestamos/cobranza")({
  head: () => ({ meta: [{ title: "Cobranza — Increscendo Fintech" }] }),
  component: CobranzaLayout,
});

const BUCKETS: [string, string][] = [
  ["1-7", "1–7 días"],
  ["8-30", "8–30 días"],
  ["31-60", "31–60 días"],
  ["60+", "Más de 60"],
];

function CobranzaLayout() {
  const { data = [] } = useLoans();
  const overdue = data.filter((l) => l.stage === "activo" && !l.portfolioSold && l.daysOverdue > 0);
  const tabs: Tab[] = [
    { label: `Atrasados${overdue.length ? ` (${overdue.length})` : ""}`, to: "/admin/prestamos/cobranza" },
    { label: "Próximos cobros", to: "/admin/prestamos/cobranza/proximos" },
    { label: "Cobros fallidos", to: "/admin/prestamos/cobranza/fallidos" },
  ];
  return (
    <PermissionGuard recurso="prestamos">
      <PageHeader
        title="Cobranza"
        description="Cuotas atrasadas, calendario de cargos de Belvo/Druo y cobros rechazados. Avisa o cobra desde el menú ⋯."
      />
      <SampleDataNotice />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {BUCKETS.map(([k, label]) => {
          const ls = overdue.filter((l) => agingBucket(l.daysOverdue) === k);
          return (
            <div key={k} className={`rounded-xl border p-3 bg-card ${k === "60+" || k === "31-60" ? "border-red-200" : "border-border"}`}>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="font-display text-xl font-semibold tabular-nums">{ls.length}</div>
              <div className="text-xs text-muted-foreground tabular-nums">{money(ls.reduce((s, l) => s + l.monthlyPayment, 0))} en cuotas</div>
            </div>
          );
        })}
      </div>
      <TabLayout tabs={tabs}>
        <Outlet />
      </TabLayout>
    </PermissionGuard>
  );
}
