import { createFileRoute } from "@tanstack/react-router";
import { CollectionTable } from "@/components/loans/loans-table";
import { InfoNote } from "@/components/ui-kit";

export const Route = createFileRoute("/admin/prestamos/cobranza/proximos")({
  component: () => (
    <div className="space-y-3">
      <InfoNote>
        Fechas en que Belvo/Druo intentarán el cargo programado (próximos 15 días). Úsalas para mandar avisos antes del cargo o
        para planear cobros bajo demanda.
      </InfoNote>
      <CollectionTable view="proximos" />
    </div>
  ),
});
