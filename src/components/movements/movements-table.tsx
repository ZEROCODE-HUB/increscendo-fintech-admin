import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, User } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { ActionsDropdown } from "@/components/actions-dropdown";
import { ModalDialog } from "@/components/modal-dialog";
import { ClientLink, DetailGrid, InfoNote, MovementStatusBadge } from "@/components/ui-kit";
import { useMovements } from "@/hooks/queries";
import { dateTime, money } from "@/lib/format";
import { failedReasonLabel } from "@/lib/loans/status";
import { MOVEMENT_STATUS_LABEL, MOVEMENT_TYPE_LABEL, PROVIDER_LABEL } from "@/lib/api/movements";
import { isDemoMode } from "@/lib/api/source";
import type { Movement } from "@/lib/api/types";

export type MovementView = "todos" | "membresia" | "prestamo" | "tarjeta" | "servicio";

type Row = Movement & { typeLabel: string; statusLabel: string; providerLabel: string; productLabel: string; signed: number };

const PRODUCT_LABEL: Record<Movement["product"], string> = {
  membresia: "Membresía",
  prestamo: "Préstamo",
  tarjeta: "Tarjeta",
  servicio: "Servicios",
  transferencia: "Transferencia",
};

function MovementDetail({ m, onClose }: { m: Row; onClose: () => void }) {
  return (
    <ModalDialog open onClose={onClose} title={m.typeLabel} description={dateTime(m.date)} size="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MovementStatusBadge status={m.status} label={m.statusLabel} />
          <span className={`font-display text-2xl font-semibold tabular-nums ${m.direction === "salida" ? "text-red-600" : ""}`}>
            {m.direction === "salida" ? "−" : "+"}
            {money(m.amount)}
          </span>
        </div>
        <DetailGrid
          cols={2}
          items={[
            { label: "Cliente", value: <ClientLink id={m.userId} name={m.clientName} /> },
            { label: "Producto", value: m.productLabel },
            { label: "Descripción", value: m.description },
            { label: "Proveedor", value: m.providerLabel },
            { label: "Método", value: m.method },
            { label: "Referencia del proveedor", value: <span className="font-mono text-xs">{m.reference}</span> },
          ]}
        />
        {m.failedReason && (
          <InfoNote>
            <strong>Motivo del rechazo:</strong> {failedReasonLabel(m.failedReason)}
          </InfoNote>
        )}
        {!m.userId && (
          <InfoNote>
            Este cobro existe en el proveedor pero no está asociado a ningún cliente. Revísalo con la referencia en el panel del
            proveedor y asígnalo (lo resuelve la sincronización diaria del backend).
          </InfoNote>
        )}
      </div>
    </ModalDialog>
  );
}

export function MovementsTable({ view }: { view: MovementView }) {
  const { data = [], isLoading } = useMovements();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Row | null>(null);
  const rows: Row[] = useMemo(
    () =>
      data
        .filter((m) => view === "todos" || m.product === view)
        .map((m) => ({
          ...m,
          typeLabel: MOVEMENT_TYPE_LABEL[m.type],
          statusLabel: MOVEMENT_STATUS_LABEL[m.status],
          providerLabel: PROVIDER_LABEL[m.provider],
          productLabel: PRODUCT_LABEL[m.product],
          signed: m.direction === "salida" ? -m.amount : m.amount,
        })),
    [data, view],
  );
  const ok = rows.filter((r) => r.status === "exitoso");
  const totals = {
    in: ok.filter((r) => r.direction === "entrada").reduce((s, r) => s + r.amount, 0),
    out: ok.filter((r) => r.direction === "salida").reduce((s, r) => s + r.amount, 0),
    failed: rows.filter((r) => r.status === "fallido").length,
    pending: rows.filter((r) => r.status === "en_proceso").length,
  };
  const cols: Column<Row>[] = [
    { key: "date", label: "Fecha", sortable: true, filterable: "date", minWidth: 130, render: (r) => dateTime(r.date) },
    { key: "clientName", label: "Cliente", sortable: true, filterable: true, minWidth: 180, maxWidth: 240, render: (r) => <ClientLink id={r.userId} name={r.clientName} /> },
    { key: "typeLabel", label: "Tipo", filterable: "enum", filterOptions: Array.from(new Set(rows.map((r) => r.typeLabel))).sort(), minWidth: 160, render: (r) => r.typeLabel },
    ...(view === "todos"
      ? [{ key: "productLabel", label: "Producto", filterable: "enum" as const, filterOptions: Array.from(new Set(rows.map((r) => r.productLabel))), minWidth: 100, render: (r: Row) => r.productLabel }]
      : []),
    { key: "description", label: "Descripción", filterable: true, minWidth: 200, maxWidth: 260, render: (r) => r.description },
    {
      key: "signed",
      label: "Monto",
      sortable: true,
      minWidth: 110,
      render: (r) => <span className={`tabular-nums ${r.direction === "salida" ? "text-red-600" : ""}`}>{r.direction === "salida" ? "−" : ""}{money(r.amount)}</span>,
    },
    { key: "statusLabel", label: "Estatus", filterable: "enum", filterOptions: Object.values(MOVEMENT_STATUS_LABEL), minWidth: 110, render: (r) => <MovementStatusBadge status={r.status} label={r.statusLabel} /> },
    { key: "providerLabel", label: "Proveedor", filterable: "enum", filterOptions: Array.from(new Set(rows.map((r) => r.providerLabel))), minWidth: 110, render: (r) => r.providerLabel },
    { key: "method", label: "Método", minWidth: 130, render: (r) => r.method },
    { key: "reference", label: "Referencia", filterable: true, minWidth: 130, render: (r) => <span className="font-mono text-xs">{r.reference}</span> },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border rounded-xl p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Entradas exitosas</div>
          <div className="font-display text-lg font-semibold tabular-nums">{money(totals.in)}</div>
        </div>
        <div className="bg-card border rounded-xl p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Salidas</div>
          <div className="font-display text-lg font-semibold tabular-nums text-red-600">{money(totals.out)}</div>
        </div>
        <div className="bg-card border rounded-xl p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Fallidos</div>
          <div className="font-display text-lg font-semibold tabular-nums">{totals.failed}</div>
        </div>
        <div className="bg-card border rounded-xl p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">En proceso</div>
          <div className="font-display text-lg font-semibold tabular-nums">{totals.pending}</div>
        </div>
      </div>
      {!isDemoMode && view !== "membresia" && (
        <InfoNote>
          Las cuotas cobradas por Belvo se ven por cliente (ficha › Movimientos) hasta que el backend publique la vista de
          movimientos unificada con sincronización diaria.
        </InfoNote>
      )}
      <DataTable
        columns={cols}
        data={rows}
        loading={isLoading}
        keyExtractor={(r) => r.id}
        dateFilterColumns={["date"]}
        emptyMessage="Sin movimientos."
        actions={(r) => (
          <ActionsDropdown
            actions={[
              { label: "Ver detalle", icon: Eye, onClick: () => setDetail(r) },
              { label: "Ver cliente", icon: User, hidden: !r.userId, onClick: () => navigate({ to: "/admin/general/usuarios/$id", params: { id: r.userId as string }, search: { tab: "movimientos" } }) },
            ]}
          />
        )}
        downloadExcel={async (d) => {
          const XLSX = await import("xlsx");
          const ws = XLSX.utils.json_to_sheet(
            d.map((r) => ({
              Fecha: dateTime(r.date),
              Cliente: r.clientName,
              Tipo: r.typeLabel,
              Producto: r.productLabel,
              Descripción: r.description,
              Monto: r.signed,
              Estatus: r.statusLabel,
              Proveedor: r.providerLabel,
              Método: r.method,
              Referencia: r.reference,
              "Motivo de rechazo": failedReasonLabel(r.failedReason) ?? "",
            })),
          );
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
          XLSX.writeFile(wb, `movimientos-${view}-${new Date().toISOString().slice(0, 10)}.xlsx`);
        }}
      />
      {detail && <MovementDetail m={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
