import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PermissionGuard } from "@/components/permission-guard";
import { DataTable, type Column } from "@/components/data-table";
import { ActionsDropdown } from "@/components/actions-dropdown";
import { FormDialog } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge, BtnPrimary, Input } from "@/components/portal-shell";
import { FieldLabel, SampleDataNotice, Select } from "@/components/ui-kit";
import { useCoupons, useRefreshAll } from "@/hooks/queries";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { date, money } from "@/lib/format";
import { deleteCoupon, saveCoupon, toggleCoupon, type CouponInput } from "@/lib/api/memberships";
import type { Coupon } from "@/lib/api/types";

export const Route = createFileRoute("/admin/membresias/cupones")({
  head: () => ({ meta: [{ title: "Cupones — Increscendo Fintech" }] }),
  component: CuponesPage,
});

function CouponDialog({ coupon, open, onClose }: { coupon: Coupon | null; open: boolean; onClose: () => void }) {
  const refresh = useRefreshAll();
  const [v, setV] = useState<CouponInput>({ code: "", type: "percent", value: 10, maxRedemptions: null, startsAt: null, endsAt: null });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV(
      coupon
        ? {
            code: coupon.code,
            type: coupon.discountPercent != null ? "percent" : "amount",
            value: coupon.discountPercent ?? coupon.discountAmount ?? 0,
            maxRedemptions: coupon.maxRedemptions,
            startsAt: coupon.startsAt?.slice(0, 10) ?? null,
            endsAt: coupon.endsAt?.slice(0, 10) ?? null,
          }
        : { code: "", type: "percent", value: 10, maxRedemptions: null, startsAt: null, endsAt: null },
    );
  }, [open, coupon]);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={coupon ? "Editar cupón" : "Nuevo cupón"}
      submitLabel={coupon ? "Guardar" : "Crear cupón"}
      isSubmitting={busy}
      onSubmit={async () => {
        if (!v.code.trim() || !(v.value > 0)) {
          toast.error("Código y valor son obligatorios.");
          return;
        }
        setBusy(true);
        try {
          await saveCoupon(v, coupon ?? undefined);
          toast.success("Cupón guardado.");
          onClose();
          await refresh();
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <FieldLabel>Código</FieldLabel>
        <Input value={v.code} onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })} placeholder="BIENVENIDA10" className="font-mono" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Tipo</FieldLabel>
          <Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as CouponInput["type"] })}>
            <option value="percent">Porcentaje</option>
            <option value="amount">Monto fijo</option>
          </Select>
        </div>
        <div>
          <FieldLabel>{v.type === "percent" ? "Descuento %" : "Descuento MXN"}</FieldLabel>
          <Input type="number" value={v.value || ""} onChange={(e) => setV({ ...v, value: Number(e.target.value) })} />
        </div>
      </div>
      <div>
        <FieldLabel hint="(vacío = ilimitado)">Usos máximos</FieldLabel>
        <Input type="number" value={v.maxRedemptions ?? ""} onChange={(e) => setV({ ...v, maxRedemptions: e.target.value ? Number(e.target.value) : null })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Desde</FieldLabel>
          <Input type="date" value={v.startsAt ?? ""} onChange={(e) => setV({ ...v, startsAt: e.target.value || null })} />
        </div>
        <div>
          <FieldLabel>Hasta</FieldLabel>
          <Input type="date" value={v.endsAt ?? ""} onChange={(e) => setV({ ...v, endsAt: e.target.value || null })} />
        </div>
      </div>
    </FormDialog>
  );
}

type Row = Coupon & { statusLabel: string; discountLabel: string };

function CuponesPage() {
  const { data = [], isLoading } = useCoupons();
  const refresh = useRefreshAll();
  const { profile } = useAuth();
  const mayEdit = can(profile?.role, "membresias.planes", "editar");
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Coupon | null>(null);
  const rows: Row[] = data.map((c) => {
    const expired = c.endsAt && new Date(c.endsAt) < new Date();
    const exhausted = c.maxRedemptions != null && c.redeemedCount >= c.maxRedemptions;
    return {
      ...c,
      statusLabel: !c.active ? "Inactivo" : expired ? "Vencido" : exhausted ? "Agotado" : "Activo",
      discountLabel: c.discountPercent != null ? `${c.discountPercent}%` : money(c.discountAmount),
    };
  });
  const cols: Column<Row>[] = [
    { key: "code", label: "Código", filterable: true, sortable: true, minWidth: 140, render: (r) => <span className="font-mono font-semibold">{r.code}</span> },
    { key: "discountLabel", label: "Descuento", minWidth: 100, render: (r) => r.discountLabel },
    { key: "uses", label: "Usos", minWidth: 100, render: (r) => `${r.redeemedCount}${r.maxRedemptions != null ? ` / ${r.maxRedemptions}` : ""}` },
    { key: "startsAt", label: "Desde", minWidth: 100, render: (r) => date(r.startsAt) },
    { key: "endsAt", label: "Fecha de fin", filterable: "date", sortable: true, minWidth: 100, render: (r) => date(r.endsAt) },
    {
      key: "statusLabel",
      label: "Estatus",
      filterable: "enum",
      filterOptions: ["Activo", "Inactivo", "Vencido", "Agotado"],
      minWidth: 100,
      render: (r) => <Badge tone={r.statusLabel === "Activo" ? "success" : "neutral"}>{r.statusLabel}</Badge>,
    },
  ];
  return (
    <PermissionGuard recurso="membresias">
      <PageHeader
        title="Cupones"
        description="Descuentos aplicables a la compra de membresías."
        action={
          mayEdit && (
            <BtnPrimary type="button" onClick={() => setCreating(true)}>
              <Plus size={16} /> Nuevo cupón
            </BtnPrimary>
          )
        }
      />
      <SampleDataNotice />
      <DataTable
        columns={cols}
        data={rows}
        loading={isLoading}
        keyExtractor={(r) => r.id}
        emptyMessage="Sin cupones."
        actions={(r) =>
          mayEdit ? (
            <ActionsDropdown
              actions={[
                { label: "Editar", icon: Pencil, onClick: () => setEditing(r) },
                {
                  label: r.active ? "Desactivar" : "Activar",
                  icon: Power,
                  onClick: async () => {
                    await toggleCoupon(r);
                    toast.success("Cupón actualizado.");
                    await refresh();
                  },
                },
                { label: "Eliminar", icon: Trash2, variant: "danger", divider: true, onClick: () => setDeleting(r) },
              ]}
            />
          ) : null
        }
      />
      <CouponDialog coupon={editing} open={!!editing || creating} onClose={() => { setEditing(null); setCreating(false); }} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Eliminar cupón"
        message={`Se eliminará ${deleting?.code}. Esta acción no se puede deshacer.`}
        variant="danger"
        confirmLabel="Eliminar"
        onConfirm={async () => {
          if (!deleting) return;
          await deleteCoupon(deleting);
          toast.success("Cupón eliminado.");
          setDeleting(null);
          await refresh();
        }}
      />
    </PermissionGuard>
  );
}
