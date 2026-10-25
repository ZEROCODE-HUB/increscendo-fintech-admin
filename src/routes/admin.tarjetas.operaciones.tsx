import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Play } from "lucide-react";
import { BtnPrimary, Input } from "@/components/portal-shell";
import { FieldLabel, InfoNote, SectionCard, Select, Spinner } from "@/components/ui-kit";
import { CardsPage } from "@/components/cards/cards-common";
import { runOneCardOperation, type OneCardOperation } from "@/lib/api/cards";
import { logActivity } from "@/lib/api/activity";

export const Route = createFileRoute("/admin/tarjetas/operaciones")({
  head: () => ({ meta: [{ title: "Operaciones OneCard — Increscendo Fintech" }] }),
  component: Operaciones,
});

const OPS: [OneCardOperation, string][] = [
  ["consultar_saldo", "Consultar saldo de tarjeta"],
  ["consultar_movimientos", "Consultar movimientos de tarjeta"],
  ["consultar_estatus", "Consultar estatus de tarjeta"],
  ["saldo_cuenta_maestra", "Saldo de la Cuenta Maestra"],
];

function Operaciones() {
  const [op, setOp] = useState<OneCardOperation>("consultar_saldo");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  return (
    <CardsPage
      title="Operaciones"
      description="Panel técnico para consultas manuales directas a OneCard. Solo lectura; cada consulta queda en Registros."
      recurso="tarjetas.operaciones"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Consulta">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const r = await runOneCardOperation(op, ref);
                setResult(r);
                void logActivity("Consulta manual OneCard", "OneCard", ref || "cuenta maestra", op);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div>
              <FieldLabel>Servicio</FieldLabel>
              <Select value={op} onChange={(e) => setOp(e.target.value as OneCardOperation)}>
                {OPS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            {op !== "saldo_cuenta_maestra" && (
              <div>
                <FieldLabel hint="(últimos 4 dígitos o número completo)">Tarjeta</FieldLabel>
                <Input value={ref} onChange={(e) => setRef(e.target.value)} className="font-mono" />
              </div>
            )}
            <BtnPrimary type="submit" disabled={busy}>
              {busy ? <Spinner /> : <Play size={14} />} Ejecutar
            </BtnPrimary>
          </form>
          <div className="mt-4">
            <InfoNote>Útil para soporte: verificar en tiempo real lo que reporta OneCard cuando un cliente dice que su saldo no coincide.</InfoNote>
          </div>
        </SectionCard>
        <SectionCard title="Respuesta de OneCard">
          <pre className="text-xs bg-muted/60 rounded-lg p-3 overflow-auto max-h-96 font-mono">{result ? JSON.stringify(result, null, 2) : "Sin consultas todavía."}</pre>
        </SectionCard>
      </div>
    </CardsPage>
  );
}
