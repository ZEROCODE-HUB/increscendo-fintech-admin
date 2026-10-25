import { DataTable, type Column } from "@/components/data-table";
import { useActivity } from "@/hooks/queries";
import { dateTime } from "@/lib/format";
import type { ActivityEntry } from "@/lib/api/types";

export function ActivityTable() {
  const { data = [], isLoading } = useActivity();
  const cols: Column<ActivityEntry>[] = [
    { key: "at", label: "Fecha", sortable: true, filterable: "date", minWidth: 130, render: (r) => dateTime(r.at) },
    { key: "user", label: "Usuario", filterable: "enum", filterOptions: Array.from(new Set(data.map((d) => d.user))).sort(), minWidth: 150, render: (r) => r.user },
    { key: "action", label: "Acción", filterable: true, minWidth: 200, render: (r) => <span className="font-medium">{r.action}</span> },
    { key: "entity", label: "Sobre", filterable: "enum", filterOptions: Array.from(new Set(data.map((d) => d.entity))).sort(), minWidth: 120, render: (r) => r.entity },
    { key: "entityId", label: "Referencia", filterable: true, minWidth: 120, render: (r) => <span className="font-mono text-xs">{r.entityId}</span> },
    { key: "detail", label: "Detalle", minWidth: 220, maxWidth: 320, render: (r) => r.detail || "—" },
  ];
  return <DataTable columns={cols} data={data} loading={isLoading} keyExtractor={(r) => r.id} dateFilterColumns={["at"]} />;
}
