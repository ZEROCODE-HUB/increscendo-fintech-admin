import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, CreditCard, Pencil, Plus, Power } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PermissionGuard } from "@/components/permission-guard";
import { FormDialog } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge, BtnOutline, BtnPrimary, Input } from "@/components/portal-shell";
import { FieldLabel, InfoNote, SampleDataNotice, Select, Textarea } from "@/components/ui-kit";
import { usePlans, useRefreshAll, useSubscriptions } from "@/hooks/queries";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { money } from "@/lib/format";
import { savePlan, togglePlan, type PlanInput } from "@/lib/api/memberships";
import type { MembershipPlan } from "@/lib/api/types";

export const Route = createFileRoute("/admin/membresias/planes")({
  head: () => ({ meta: [{ title: "Planes y beneficios — Increscendo Fintech" }] }),
  component: PlanesPage,
});

function PlanDialog({ plan, open, onClose }: { plan: MembershipPlan | null; open: boolean; onClose: () => void }) {
  const refresh = useRefreshAll();
  const blank: PlanInput = { name: "", price: 0, interval: "year", frequency: 1, benefits: [], targetAudience: "", interestRate: null, includesCard: false };
  const [v, setV] = useState<PlanInput>(blank);
  const [benefits, setBenefits] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (plan) {
      const yearly = plan.durationDays % 365 === 0;
      setV({
        name: plan.name,
        price: plan.price,
        interval: yearly ? "year" : plan.durationDays % 30 === 0 ? "month" : "week",
        frequency: yearly ? plan.durationDays / 365 : plan.durationDays % 30 === 0 ? plan.durationDays / 30 : Math.max(1, plan.durationDays / 7),
        benefits: plan.benefits,
        targetAudience: plan.targetAudience,
        interestRate: plan.interestRate,
        includesCard: plan.includesCard,
      });
      setBenefits(plan.benefits.join("\n"));
    } else {
      setV(blank);
      setBenefits("");
    }
  }, [open, plan]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={plan ? `Editar plan ${plan.name}` : "Nuevo plan"}
      description={plan ? "Los cambios aplican a nuevas compras y renovaciones." : "Se crea en Conekta y en la base de Increscendo."}
      submitLabel={plan ? "Guardar" : "Crear plan"}
      isSubmitting={busy}
      size="lg"
      onSubmit={async () => {
        const list = benefits.split(/\n|,/).map((b) => b.trim()).filter(Boolean);
        if (!v.name.trim() || !(v.price > 0) || !list.length) {
          toast.error("Nombre, precio y al menos un beneficio son obligatorios.");
          return;
        }
        setBusy(true);
        try {
          await savePlan({ ...v, benefits: list }, plan ?? undefined);
          toast.success(plan ? "Plan actualizado." : "Plan creado.");
          onClose();
          await refresh();
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <FieldLabel>Nombre</FieldLabel>
          <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <FieldLabel>Precio (MXN)</FieldLabel>
          <Input type="number" value={v.price || ""} onChange={(e) => setV({ ...v, price: Number(e.target.value) })} />
        </div>
        <div>
          <FieldLabel>Cada</FieldLabel>
          <Input type="number" min={1} value={v.frequency} onChange={(e) => setV({ ...v, frequency: Math.max(1, Number(e.target.value)) })} />
        </div>
        <div>
          <FieldLabel>Periodo</FieldLabel>
          <Select value={v.interval} onChange={(e) => setV({ ...v, interval: e.target.value as PlanInput["interval"] })}>
            <option value="week">Semana(s)</option>
            <option value="month">Mes(es)</option>
            <option value="year">Año(s)</option>
          </Select>
        </div>
      </div>
      <div>
        <FieldLabel hint="(uno por línea)">Beneficios</FieldLabel>
        <Textarea rows={5} value={benefits} onChange={(e) => setBenefits(e.target.value)} placeholder={"Pago de servicios\n5% de descuento\nSeguro de gastos médicos"} />
      </div>
      <div>
        <FieldLabel>Para quién es</FieldLabel>
        <Input value={v.targetAudience} onChange={(e) => setV({ ...v, targetAudience: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <FieldLabel hint="(si el plan da acceso a préstamo)">Tasa anual de préstamo %</FieldLabel>
          <Input
            type="number"
            step="0.01"
            value={v.interestRate != null ? (v.interestRate * 100).toString() : ""}
            onChange={(e) => setV({ ...v, interestRate: e.target.value ? Number(e.target.value) / 100 : null })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm h-10">
          <input type="checkbox" className="accent-primary" checked={v.includesCard} onChange={(e) => setV({ ...v, includesCard: e.target.checked })} />
          Incluye tarjeta prepago
        </label>
      </div>
      <InfoNote>
        No ofrezcas beneficios que impliquen cobrar con tarjeta de débito/crédito para abonar saldo a otra tarjeta (indicación de
        Conekta).
      </InfoNote>
    </FormDialog>
  );
}

function PlanesPage() {
  const { data: plans = [] } = usePlans();
  const { data: subs = [] } = useSubscriptions();
  const refresh = useRefreshAll();
  const { profile } = useAuth();
  const mayEdit = can(profile?.role, "membresias.planes", "editar");
  const [editing, setEditing] = useState<MembershipPlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<MembershipPlan | null>(null);
  return (
    <PermissionGuard recurso="membresias">
      <PageHeader
        title="Planes y beneficios"
        description="Lo que incluye cada membresía. Los cambios se reflejan en la app sin desarrollo."
        action={
          mayEdit && (
            <BtnPrimary type="button" onClick={() => setCreating(true)}>
              <Plus size={16} /> Nuevo plan
            </BtnPrimary>
          )
        }
      />
      <SampleDataNotice />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {plans.map((p) => {
          const active = subs.filter((s) => s.planId === p.id && s.status === "active").length;
          return (
            <div key={p.id} className={`bg-card border rounded-xl p-5 flex flex-col ${p.active ? "border-border" : "border-dashed border-border opacity-70"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-semibold">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">{p.targetAudience}</p>
                </div>
                <Badge tone={p.active ? "success" : "neutral"}>{p.active ? "Activo" : "Inactivo"}</Badge>
              </div>
              <div className="mt-3">
                <span className="font-display text-2xl font-semibold">{money(p.price)}</span>
                <span className="text-xs text-muted-foreground"> / {p.durationDays >= 365 ? `${Math.round(p.durationDays / 365)} año` : `${p.durationDays} días`}</span>
              </div>
              <ul className="mt-4 space-y-1.5 flex-1">
                {p.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <Check size={14} className="text-brand-accent mt-0.5 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {p.includesCard && (
                  <Badge tone="info">
                    <CreditCard size={11} className="mr-1" /> Tarjeta
                  </Badge>
                )}
                {p.interestRate != null && <Badge tone="neutral">Préstamo {Math.round(p.interestRate * 100)}% anual</Badge>}
                <Badge tone="neutral">{active} socios activos</Badge>
              </div>
              {mayEdit && (
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <BtnOutline type="button" className="flex-1 h-9" onClick={() => setEditing(p)}>
                    <Pencil size={14} /> Editar
                  </BtnOutline>
                  <BtnOutline type="button" className="h-9" onClick={() => setToggling(p)} title={p.active ? "Desactivar" : "Activar"}>
                    <Power size={14} />
                  </BtnOutline>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <PlanDialog plan={editing} open={!!editing || creating} onClose={() => { setEditing(null); setCreating(false); }} />
      <ConfirmDialog
        open={!!toggling}
        onClose={() => setToggling(null)}
        title={toggling?.active ? "Desactivar plan" : "Activar plan"}
        message={toggling?.active ? "Dejará de ofrecerse a clientes nuevos. Las membresías vigentes no cambian." : "Volverá a ofrecerse en la app."}
        confirmLabel="Confirmar"
        onConfirm={async () => {
          if (!toggling) return;
          try {
            await togglePlan(toggling);
            toast.success("Plan actualizado.");
            setToggling(null);
            await refresh();
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </PermissionGuard>
  );
}
