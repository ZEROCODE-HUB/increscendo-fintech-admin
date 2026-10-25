import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PermissionGuard } from "@/components/permission-guard";
import { BtnOutline, Input } from "@/components/portal-shell";
import { FieldLabel, KYC_LABEL, SampleDataNotice, SectionCard } from "@/components/ui-kit";
import { useClients, useLoans, useMovements, useSubscriptions } from "@/hooks/queries";
import { useAuth } from "@/lib/auth";
import { date, money } from "@/lib/format";
import { PROVIDER_LABEL } from "@/lib/api/movements";
import { bankName } from "@/lib/api/catalogs-data";

export const Route = createFileRoute("/admin/administracion/reportes")({
  head: () => ({ meta: [{ title: "Reportes — Increscendo Fintech" }] }),
  component: Reportes,
});

type ReportKey = "altas" | "cobros" | "cartera" | "membresias";

const REPORTS: { key: ReportKey; title: string; description: string }[] = [
  { key: "altas", title: "Altas por ejecutivo", description: "Clientes dados de alta en el periodo, por ejecutivo." },
  { key: "cobros", title: "Cobros por proveedor", description: "Cobros pagados y fallidos en el periodo por Belvo, Druo y Conekta." },
  { key: "cartera", title: "Cartera y mora", description: "Préstamos activos con su cuota pendiente, mes y días de atraso." },
  { key: "membresias", title: "Membresías e ingresos", description: "Membresías vendidas en el periodo e ingresos por plan." },
];

async function exportRows(name: string, rows: Record<string, unknown>[]) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 30));
  XLSX.writeFile(wb, `${name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function ReportTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground py-6 text-center">Sin datos en el periodo.</p>;
  const headers = Object.keys(rows[0]);
  return (
    <div className="border rounded-lg overflow-x-auto max-h-[460px]">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b sticky top-0">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {headers.map((h) => (
                <td key={h} className="px-3 py-1.5 whitespace-nowrap">
                  {typeof r[h] === "number" && /monto|ingreso|cuota|total/i.test(h) ? money(r[h] as number) : String(r[h] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Reportes() {
  const { profile } = useAuth();
  const isAgent = profile?.role === "agente";
  const today = new Date();
  const [from, setFrom] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [report, setReport] = useState<ReportKey>("altas");
  const { data: clients = [] } = useClients();
  const { data: movements = [] } = useMovements();
  const { data: loans = [] } = useLoans();
  const { data: subs = [] } = useSubscriptions();
  const inRange = (d: string | null | undefined) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    return t >= new Date(`${from}T00:00:00`).getTime() && t <= new Date(`${to}T23:59:59`).getTime();
  };

  const rows = useMemo<Record<string, unknown>[]>(() => {
    switch (report) {
      case "altas": {
        const own = clients.filter((c) => inRange(c.createdAt) && (!isAgent || c.executiveId === profile?.id));
        return own.map((c) => ({
          Fecha: date(c.createdAt),
          Ejecutivo: c.executiveName ?? "Registro directo",
          Cliente: c.fullName,
          Correo: c.email,
          Identidad: KYC_LABEL[c.kyc.status],
          Membresía: c.membership?.planName ?? "—",
        }));
      }
      case "cobros":
        return movements
          .filter((m) => inRange(m.date) && m.direction === "entrada" && (m.status === "exitoso" || m.status === "fallido"))
          .map((m) => ({
            Fecha: date(m.date),
            Proveedor: PROVIDER_LABEL[m.provider],
            Cliente: m.clientName,
            Concepto: m.description,
            Monto: m.amount,
            Resultado: m.status === "exitoso" ? "Pagado" : "Fallido",
            Referencia: m.reference,
          }));
      case "cartera":
        return loans
          .filter((l) => l.stage === "activo")
          .map((l) => ({
            Folio: l.folio,
            Cliente: l.clientName,
            "Monto prestado": l.amount,
            "Cuotas pagadas": `${l.paidInstallments}/${l.installments}`,
            "Cuota pendiente": Math.min(l.paidInstallments + 1, l.installments),
            "Mes de la cuota": l.nextPaymentDate ? new Date(l.nextPaymentDate).toLocaleDateString("es-MX", { month: "long", year: "numeric" }) : "—",
            "Monto cuota": l.monthlyPayment,
            "Días de atraso": l.daysOverdue,
            "Saldo total": Math.max(0, l.totalToPay - l.paidAmount),
            Banco: bankName(l.bank),
          }));
      default: {
        const sold = subs.filter((s) => inRange(s.startedAt));
        const byPlan = new Map<string, { n: number; total: number }>();
        for (const s of sold) {
          const p = byPlan.get(s.planName) ?? { n: 0, total: 0 };
          p.n += 1;
          p.total += s.price;
          byPlan.set(s.planName, p);
        }
        return Array.from(byPlan.entries()).map(([plan, v]) => ({ Plan: plan, "Membresías vendidas": v.n, Ingresos: v.total }));
      }
    }
  }, [report, clients, movements, loans, subs, from, to, isAgent, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = isAgent ? REPORTS.filter((r) => r.key === "altas") : REPORTS;
  const current = REPORTS.find((r) => r.key === report)!;

  return (
    <PermissionGuard recurso="reportes">
      <PageHeader title="Reportes" description="Altas, cobros, cartera y membresías del periodo, exportables a Excel." />
      <SampleDataNotice />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        {visible.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setReport(r.key)}
            className={`text-left rounded-xl border p-4 transition-colors ${report === r.key ? "border-brand bg-brand-light" : "border-border bg-card hover:bg-muted/40"}`}
          >
            <div className="text-sm font-semibold">{r.title}</div>
            <div className="text-xs text-muted-foreground mt-1">{r.description}</div>
          </button>
        ))}
      </div>
      <SectionCard
        title={current.title}
        description={isAgent ? "Solo tus altas." : current.description}
        action={
          <BtnOutline type="button" onClick={() => exportRows(current.title, rows)} disabled={!rows.length}>
            <Download size={16} /> Exportar Excel
          </BtnOutline>
        }
      >
        {report !== "cartera" && (
          <div className="flex flex-wrap gap-3 mb-4">
            <div>
              <FieldLabel>Desde</FieldLabel>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Hasta</FieldLabel>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        )}
        <ReportTable rows={rows} />
      </SectionCard>
    </PermissionGuard>
  );
}
