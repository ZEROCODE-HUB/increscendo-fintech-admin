import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, CircleAlert, CreditCard, FileSignature, HandCoins, Inbox, Landmark, ShieldCheck, TimerReset, UserRoundSearch } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PermissionGuard } from "@/components/permission-guard";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/portal-shell";
import { SampleDataNotice, Select } from "@/components/ui-kit";
import { RouteSkeleton } from "@/components/route-skeleton";
import { useBackofficeUsers, usePending } from "@/hooks/queries";
import { assignPending } from "@/lib/api/pending";
import { dateLong } from "@/lib/format";
import type { PendingItem, PendingKind } from "@/lib/api/types";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/general/pendientes")({
  head: () => ({ meta: [{ title: "Pendientes — Increscendo Fintech" }] }),
  component: PendientesPage,
});

const KIND: Record<PendingKind, { label: string; icon: typeof Inbox; tone: string }> = {
  kyc: { label: "Identidad", icon: ShieldCheck, tone: "bg-amber-50 text-amber-700" },
  solicitud_prestamo: { label: "Solicitud de préstamo", icon: Landmark, tone: "bg-brand-cyan-light text-brand-navy" },
  firma: { label: "Firma", icon: FileSignature, tone: "bg-brand-cyan-light text-brand-navy" },
  desembolso: { label: "Desembolso", icon: HandCoins, tone: "bg-emerald-50 text-emerald-700" },
  cuota_atrasada: { label: "Cobranza", icon: CircleAlert, tone: "bg-red-50 text-red-700" },
  membresia_por_vencer: { label: "Renovación", icon: TimerReset, tone: "bg-violet-50 text-violet-700" },
  tarjeta_solicitud: { label: "Tarjeta", icon: CreditCard, tone: "bg-brand-light text-brand-dark" },
  tarjeta_reportada: { label: "Tarjeta reportada", icon: CreditCard, tone: "bg-red-50 text-red-700" },
  cobro_sin_cliente: { label: "Cobro sin cliente", icon: UserRoundSearch, tone: "bg-red-50 text-red-700" },
};

function PendientesPage() {
  const { data = [], isLoading } = usePending();
  const { data: users = [] } = useBackofficeUsers();
  const qc = useQueryClient();
  const [kind, setKind] = useState<"" | PendingKind>("");
  const [priority, setPriority] = useState("");
  const [assignee, setAssignee] = useState("");
  const filtered = useMemo(
    () =>
      data.filter(
        (p) =>
          (!kind || p.kind === kind) &&
          (!priority || p.priority === priority) &&
          (!assignee || (assignee === "__none" ? !p.assignee : p.assignee === assignee)),
      ),
    [data, kind, priority, assignee],
  );
  const counts = useMemo(() => {
    const c = new Map<PendingKind, number>();
    for (const p of data) c.set(p.kind, (c.get(p.kind) ?? 0) + 1);
    return c;
  }, [data]);

  if (isLoading) return <RouteSkeleton />;
  return (
    <PermissionGuard recurso="pendientes">
      <PageHeader
        title="Pendientes"
        description="Todo lo que espera una acción, de cualquier producto. Asigna cada pendiente a una persona del equipo."
      />
      <SampleDataNotice />
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setKind("")}
          className={`px-3 h-8 rounded-full text-xs font-semibold border ${!kind ? "bg-brand-navy text-white border-brand-navy" : "bg-card border-border"}`}
        >
          Todos ({data.length})
        </button>
        {(Object.keys(KIND) as PendingKind[])
          .filter((k) => counts.get(k))
          .map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`px-3 h-8 rounded-full text-xs font-semibold border ${kind === k ? "bg-brand-navy text-white border-brand-navy" : "bg-card border-border"}`}
            >
              {KIND[k].label} ({counts.get(k)})
            </button>
          ))}
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="w-44">
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-9 text-xs">
            <option value="">Todas las prioridades</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </Select>
        </div>
        <div className="w-56">
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="h-9 text-xs">
            <option value="">Todos los responsables</option>
            <option value="__none">Sin asignar</option>
            {users.map((u) => (
              <option key={u.id} value={u.name}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="Sin pendientes" description="No hay nada esperando acción con estos filtros." />
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {filtered.map((p) => (
            <PendingRow
              key={p.id}
              item={p}
              users={users.map((u) => u.name)}
              onAssign={(a) => {
                assignPending(p.id, a);
                void qc.invalidateQueries({ queryKey: ["pending"] });
              }}
            />
          ))}
        </div>
      )}
    </PermissionGuard>
  );
}

function PendingRow({ item, users, onAssign }: { item: PendingItem; users: string[]; onAssign: (a: string | null) => void }) {
  const k = KIND[item.kind];
  const Icon = k.icon;
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${k.tone}`}>
        <Icon size={16} />
      </span>
      <div className="flex-1 min-w-[220px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{item.title}</span>
          <Badge tone={item.priority === "alta" ? "danger" : item.priority === "media" ? "warn" : "neutral"}>{item.priority}</Badge>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {item.clientName} · {item.detail} {item.createdAt ? `· ${dateLong(item.createdAt)}` : ""}
        </div>
      </div>
      <div className="w-44">
        <Select value={item.assignee ?? ""} onChange={(e) => onAssign(e.target.value || null)} className="h-8 text-xs">
          <option value="">Sin asignar</option>
          {users.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </Select>
      </div>
      <Link
        to={item.link}
        className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-border text-xs font-semibold hover:bg-muted/40"
      >
        Atender <ArrowRight size={13} />
      </Link>
    </div>
  );
}
