import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, Inbox, XCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionCard, SampleDataNotice } from "@/components/ui-kit";
import { RouteSkeleton } from "@/components/route-skeleton";
import { useDashboard, usePending } from "@/hooks/queries";
import { money, moneyShort, percent } from "@/lib/format";
import { FEATURE_CARDS } from "@/lib/feature-flags";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — Increscendo Fintech" }] }),
  component: Dashboard,
});

function Kpi({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-semibold text-foreground mt-1 tabular-nums">{value}</div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 min-h-4">
        {trend !== undefined && trend !== 0 && (
          <span className={`inline-flex items-center ${trend > 0 ? "text-emerald-600" : "text-red-600"}`}>
            {trend > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(Math.round(trend * 100))}%
          </span>
        )}
        {sub}
      </div>
    </div>
  );
}

function TodayItem({ icon: Icon, label, value, to, tone }: { icon: typeof Inbox; label: string; value: number | string; to: string; tone: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted/40 transition-colors">
      <span className={`h-9 w-9 rounded-full flex items-center justify-center ${tone}`}>
        <Icon size={17} />
      </span>
      <span className="flex-1 text-sm text-foreground">{label}</span>
      <span className="font-display text-lg font-semibold tabular-nums">{value}</span>
    </Link>
  );
}

const ratio = (a: number, b: number) => (b ? (a - b) / b : a ? 1 : 0);

function Dashboard() {
  const { data, isLoading } = useDashboard();
  const { data: pending = [] } = usePending();
  const { profile } = useAuth();
  if (isLoading || !data) return <RouteSkeleton />;
  const high = pending.filter((p) => p.priority === "alta").length;
  const funnelMax = Math.max(1, ...data.funnel.map((f) => f.value));

  return (
    <div className="space-y-5">
      <PageHeader title={`Hola, ${profile?.fullName.split(" ")[0] ?? ""}`} description="Lo que necesita atención hoy y cómo va el negocio." />
      <SampleDataNotice />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <TodayItem icon={Inbox} label={`Pendientes (${high} de alta prioridad)`} value={pending.length} to="/admin/general/pendientes" tone="bg-amber-50 text-amber-700" />
        <TodayItem icon={CalendarClock} label="Cobros programados esta semana" value={data.chargesWeek} to="/admin/prestamos/cobranza/proximos" tone="bg-brand-cyan-light text-brand-navy" />
        <TodayItem icon={XCircle} label="Cobros fallidos (7 días)" value={data.failedCharges7d} to="/admin/prestamos/cobranza/fallidos" tone="bg-red-50 text-red-700" />
        <TodayItem icon={AlertTriangle} label="Préstamos con cuota atrasada" value={data.overdueLoans} to="/admin/prestamos/cobranza" tone="bg-orange-50 text-orange-700" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Altas esta semana" value={String(data.newClientsWeek)} trend={ratio(data.newClientsWeek, data.newClientsPrevWeek)} sub="vs. semana anterior" />
        <Kpi label="Membresías activas" value={String(data.activeMemberships)} />
        <Kpi label="Ingresos por membresías (mes)" value={moneyShort(data.membershipRevenueMonth)} trend={ratio(data.membershipRevenueMonth, data.membershipRevenuePrevMonth)} sub="vs. mes anterior" />
        {FEATURE_CARDS ? (
          <Kpi label="Tarjetas activas" value={String(data.activeCards)} sub={`${moneyShort(data.cardBalance)} en saldo`} />
        ) : (
          <Kpi label="Clientes registrados" value={String(data.funnel[0]?.value ?? 0)} />
        )}
        <Kpi label="Préstamos activos" value={String(data.activeLoans)} sub={`${moneyShort(data.portfolioOutstanding)} por cobrar`} />
        <Kpi label="Mora" value={percent(data.moraRate)} sub={`${data.overdueLoans} préstamos · ${moneyShort(data.overdueAmount)}`} />
        <Kpi label="Cobros hoy" value={String(data.chargesToday)} sub="según calendario de Belvo/Druo" />
        <Kpi label="Por desembolsar" value={moneyShort(data.pendingDisbursementAmount)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <SectionCard title="Embudo de conversión" description="Dónde se quedan los clientes: registro → membresía → identidad → tarjeta." className="xl:col-span-1">
          <div className="space-y-3">
            {data.funnel.map((f, i) => {
              const prev = i ? data.funnel[i - 1].value : f.value;
              return (
                <div key={f.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-foreground font-medium">{f.label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {f.value}
                      {i > 0 && prev ? ` · ${Math.round((f.value / prev) * 100)}%` : ""}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-brand-accent" style={{ width: `${(f.value / funnelMax) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Altas y membresías (6 meses)" className="xl:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="altas" name="Altas" fill="#1c2e4a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="membresias" name="Membresías" fill="#23957e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <SectionCard title="Ingresos por membresías" className="xl:col-span-2">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => moneyShort(v)} width={70} />
                <Tooltip formatter={(v: number) => money(v)} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="ingresos" name="Ingresos" fill="#1fa5c4" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="Altas por ejecutivo (30 días)">
          {data.byExecutive.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin altas en los últimos 30 días.</p>
          ) : (
            <ul className="space-y-2">
              {data.byExecutive.map((e) => (
                <li key={e.name} className="flex justify-between text-sm">
                  <span>{e.name}</span>
                  <span className="font-semibold tabular-nums">{e.altas}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Antigüedad de la mora" description="Cuotas atrasadas por tramo de días.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {data.aging.map((a) => (
            <Link key={a.bucket} to="/admin/prestamos/cobranza" className="rounded-lg border border-border p-3 hover:bg-muted/40">
              <div className="text-xs text-muted-foreground">{a.bucket}</div>
              <div className="font-display text-xl font-semibold tabular-nums">{a.count}</div>
              <div className="text-xs text-muted-foreground tabular-nums">{money(a.amount)}</div>
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
