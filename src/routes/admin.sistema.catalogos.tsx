import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PermissionGuard } from "@/components/permission-guard";
import { DataTable, type Column } from "@/components/data-table";
import { FormDialog } from "@/components/form-dialog";
import { Badge, BtnPrimary, Input } from "@/components/portal-shell";
import { FieldLabel, InfoNote, SampleDataNotice, Textarea } from "@/components/ui-kit";
import { useBanks, useRefreshAll, useRejectionReasons } from "@/hooks/queries";
import { addManualBank, saveRejectionReason } from "@/lib/api/catalogs";
import type { Bank, RejectionReason } from "@/lib/api/types";

export const Route = createFileRoute("/admin/sistema/catalogos")({
  validateSearch: (s: Record<string, unknown>): { tab?: "motivos" | "bancos" } => (s.tab === "bancos" ? { tab: "bancos" } : {}),
  head: () => ({ meta: [{ title: "Catálogos — Increscendo Fintech" }] }),
  component: Catalogos,
});

const APPLIES: Record<string, string> = { identidad: "Identidad", prestamo: "Préstamo", tarjeta: "Tarjeta" };

function ReasonEditor({ reason, onClose }: { reason: RejectionReason; onClose: () => void }) {
  const refresh = useRefreshAll();
  const [v, setV] = useState(reason);
  return (
    <FormDialog
      open
      onClose={onClose}
      title={`Motivo ${reason.code}`}
      submitLabel="Guardar"
      size="lg"
      onSubmit={async () => {
        await saveRejectionReason(v);
        toast.success("Motivo actualizado.");
        onClose();
        await refresh();
      }}
    >
      <div>
        <FieldLabel>Nombre interno</FieldLabel>
        <Input value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} />
      </div>
      <div>
        <FieldLabel>Mensaje orientador para el cliente</FieldLabel>
        <Textarea rows={4} value={v.clientMessage} onChange={(e) => setV({ ...v, clientMessage: e.target.value })} />
      </div>
      <div>
        <FieldLabel hint="(separados por coma)">Códigos de Belvo que se traducen a este motivo</FieldLabel>
        <Input value={v.belvoCodes.join(", ")} onChange={(e) => setV({ ...v, belvoCodes: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} className="font-mono" />
      </div>
    </FormDialog>
  );
}

function Catalogos() {
  const { tab = "motivos" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: reasons = [] } = useRejectionReasons();
  const { data: banks = [], isLoading } = useBanks();
  const refresh = useRefreshAll();
  const [editing, setEditing] = useState<RejectionReason | null>(null);
  const [adding, setAdding] = useState(false);
  const [bankNameInput, setBankNameInput] = useState("");

  const reasonCols: Column<RejectionReason>[] = [
    { key: "code", label: "Código", minWidth: 150, render: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "label", label: "Motivo", filterable: true, minWidth: 200, render: (r) => <span className="font-medium">{r.label}</span> },
    { key: "clientMessage", label: "Mensaje al cliente", minWidth: 320, maxWidth: 420, render: (r) => r.clientMessage },
    { key: "appliesTo", label: "Aplica a", minWidth: 160, render: (r) => r.appliesTo.map((a) => APPLIES[a]).join(", ") },
    { key: "belvo", label: "Códigos Belvo", minWidth: 160, render: (r) => (r.belvoCodes.length ? <span className="font-mono text-xs">{r.belvoCodes.join(", ")}</span> : "—") },
  ];
  const bankCols: Column<Bank & { providerLabel: string }>[] = [
    { key: "name", label: "Banco", filterable: true, sortable: true, minWidth: 200, render: (r) => r.name },
    { key: "providerLabel", label: "Cobro por", filterable: "enum", filterOptions: ["Belvo", "Druo"], minWidth: 100, render: (r) => r.providerLabel },
    { key: "source", label: "Origen", minWidth: 140, render: (r) => (r.source === "belvo" ? "Catálogo Belvo" : <Badge tone="warn">Manual · validar con Belvo</Badge>) },
    { key: "active", label: "Estatus", minWidth: 90, render: (r) => <Badge tone={r.active ? "success" : "neutral"}>{r.active ? "Disponible" : "No disponible"}</Badge> },
  ];

  return (
    <PermissionGuard recurso="sistema">
      <PageHeader title="Catálogos" description="Motivos de rechazo con su mensaje al cliente y catálogo de bancos." />
      <SampleDataNotice force>Los cambios se guardan en sesión hasta que el backend cree las tablas de catálogos.</SampleDataNotice>
      <div className="flex gap-1 border-b border-border mb-4">
        {(
          [
            ["motivos", "Motivos de rechazo"],
            ["bancos", "Bancos"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => navigate({ search: k === "motivos" ? {} : { tab: k } })}
            className={`relative px-4 py-2.5 text-sm font-medium ${
              tab === k ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary" : "text-muted-foreground"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === "motivos" ? (
        <DataTable
          columns={reasonCols}
          data={reasons}
          keyExtractor={(r) => r.code}
          showDownloadButton={false}
          actions={(r) => (
            <button type="button" className="p-1.5 rounded-md hover:bg-muted" onClick={() => setEditing(r)} title="Editar">
              <Pencil size={15} />
            </button>
          )}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <InfoNote>Se intenta leer la lista de instituciones de Belvo para no mantenerla a mano. BBVA se cobra por Druo.</InfoNote>
            <BtnPrimary type="button" onClick={() => setAdding(true)}>
              <Plus size={16} /> Agregar banco
            </BtnPrimary>
          </div>
          <DataTable columns={bankCols} data={banks.map((b) => ({ ...b, providerLabel: b.provider === "druo" ? "Druo" : "Belvo" }))} loading={isLoading} keyExtractor={(r) => r.id} pageSize={20} />
        </div>
      )}
      {editing && <ReasonEditor reason={editing} onClose={() => setEditing(null)} />}
      <FormDialog
        open={adding}
        onClose={() => setAdding(false)}
        title="Agregar banco"
        description="Queda marcado para validar con Belvo antes de habilitarlo a clientes."
        submitLabel="Agregar"
        onSubmit={async () => {
          if (!bankNameInput.trim()) return;
          await addManualBank(bankNameInput.trim());
          toast.success("Banco agregado.");
          setBankNameInput("");
          setAdding(false);
          await refresh();
        }}
      >
        <FieldLabel>Nombre del banco</FieldLabel>
        <Input value={bankNameInput} onChange={(e) => setBankNameInput(e.target.value)} placeholder="Cobalto" />
      </FormDialog>
    </PermissionGuard>
  );
}
