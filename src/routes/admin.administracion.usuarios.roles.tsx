import { createFileRoute } from "@tanstack/react-router";
import { Check, Minus, Eye } from "lucide-react";
import { SectionCard } from "@/components/ui-kit";
import { PERMISSIONS, type Resource } from "@/lib/permissions";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/roles";
import type { BackofficeRole } from "@/lib/api/types";

export const Route = createFileRoute("/admin/administracion/usuarios/roles")({
  component: Roles,
});

const RESOURCES: [Resource, string][] = [
  ["dashboard", "Dashboard"],
  ["clientes", "Usuarios (clientes)"],
  ["clientes.alta", "Alta asistida"],
  ["clientes.identidad", "Revisar identidad"],
  ["movimientos", "Movimientos"],
  ["pendientes", "Pendientes"],
  ["prestamos", "Préstamos"],
  ["prestamos.aprobar", "Aprobar / rechazar préstamos"],
  ["prestamos.desembolso", "Registrar desembolsos"],
  ["prestamos.cobro", "Avisos y cobros bajo demanda"],
  ["membresias", "Membresías"],
  ["membresias.planes", "Planes y cupones"],
  ["tarjetas", "Tarjetas"],
  ["tarjetas.saldo", "Cargar saldo / Cuenta Maestra"],
  ["tarjetas.operaciones", "Operaciones OneCard"],
  ["reportes", "Reportes"],
  ["registros", "Registros"],
  ["backoffice", "Usuarios backoffice"],
  ["sistema", "Sistema"],
];

function Cell({ role, res }: { role: BackofficeRole; res: Resource }) {
  const acts = PERMISSIONS[role][res] ?? [];
  if (acts.includes("editar")) return <Check size={15} className="text-emerald-600 mx-auto" />;
  if (acts.includes("ver")) return <Eye size={15} className="text-sky-600 mx-auto" />;
  return <Minus size={15} className="text-muted-foreground/40 mx-auto" />;
}

function Roles() {
  const roles = Object.keys(ROLE_LABEL) as BackofficeRole[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {roles.map((r) => (
          <div key={r} className="bg-card border border-border rounded-xl p-4">
            <div className="font-semibold text-sm">{ROLE_LABEL[r]}</div>
            <p className="text-xs text-muted-foreground mt-1">{ROLE_DESCRIPTION[r]}</p>
          </div>
        ))}
      </div>
      <SectionCard title="Matriz de permisos" description="✓ puede modificar · 👁 solo ver · — sin acceso">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-semibold">Sección</th>
                {roles.map((r) => (
                  <th key={r} className="py-2 px-2 font-semibold text-center whitespace-nowrap">
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RESOURCES.map(([res, label]) => (
                <tr key={res} className="border-b last:border-0">
                  <td className={`py-2 pr-4 ${res.includes(".") ? "pl-4 text-muted-foreground" : "font-medium"}`}>{label}</td>
                  {roles.map((r) => (
                    <td key={r} className="py-2 px-2">
                      <Cell role={r} res={res} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
