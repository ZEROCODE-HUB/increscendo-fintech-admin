import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, CreditCard, Crown, Landmark, PencilLine, ShieldCheck, UserCheck } from "lucide-react";
import { Badge, BtnOutline, BtnPrimary } from "@/components/portal-shell";
import { RouteSkeleton } from "@/components/route-skeleton";
import { EmptyState } from "@/components/empty-state";
import { DataTable, type Column } from "@/components/data-table";
import {
  CardStatusBadge,
  DetailGrid,
  InfoNote,
  KycBadge,
  MovementStatusBadge,
  SampleDataNotice,
  SectionCard,
  SubscriptionBadge,
} from "@/components/ui-kit";
import {
  AssignMembershipDialog,
  DocumentTile,
  EditClientDialog,
  ExecutiveDialog,
  KycReviewDialog,
} from "@/components/clients/client-dialogs";
import { LoanActions } from "@/components/loans/loan-actions";
import { InstallmentsTable } from "@/components/loans/loan-dialogs";
import {
  useBankAccounts,
  useClient,
  useClientCards,
  useClientLoans,
  useClientMovements,
  useClientSubscriptions,
  useEntityActivity,
  useSchedule,
} from "@/hooks/queries";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { date, dateTime, maskClabe, money } from "@/lib/format";
import { loanStatusLabel } from "@/lib/loans/status";
import { MOVEMENT_STATUS_LABEL, MOVEMENT_TYPE_LABEL, PROVIDER_LABEL } from "@/lib/api/movements";
import { FEATURE_CARDS, FEATURE_DRUO } from "@/lib/feature-flags";
import type { Client, Loan, Movement } from "@/lib/api/types";
import type { DocumentKey } from "@/lib/api/clients";

const TABS = [
  ["resumen", "Resumen"],
  ["datos", "Datos personales"],
  ["documentos", "Documentos"],
  ["productos", "Productos"],
  ["cuentas", "Cuentas y medios de pago"],
  ["movimientos", "Movimientos"],
  ["historial", "Historial"],
] as const;
type TabKey = (typeof TABS)[number][0];

export const Route = createFileRoute("/admin/general/usuarios_/$id")({
  validateSearch: (s: Record<string, unknown>): { tab?: TabKey } => {
    const t = s.tab as TabKey | undefined;
    return TABS.some(([k]) => k === t) ? { tab: t } : {};
  },
  head: () => ({ meta: [{ title: "Ficha del cliente — Increscendo Fintech" }] }),
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const { tab = "resumen" } = Route.useSearch();
  const navigate = useNavigate();
  const { data: client, isLoading } = useClient(id);
  const { profile } = useAuth();
  const [dialog, setDialog] = useState<null | "edit" | "kyc" | "membership" | "exec">(null);
  const close = () => setDialog(null);

  if (isLoading) return <RouteSkeleton />;
  if (!client)
    return (
      <EmptyState
        title="Cliente no encontrado"
        description="Puede que haya sido eliminado o que el enlace sea incorrecto."
        action={
          <Link to="/admin/general/usuarios" className="text-brand font-semibold text-sm">
            Volver a Usuarios
          </Link>
        }
      />
    );

  const mayEdit = can(profile?.role, "clientes", "editar");
  const mayReview = can(profile?.role, "clientes.identidad", "editar");
  const setTab = (t: TabKey) => navigate({ to: "/admin/general/usuarios/$id", params: { id }, search: { tab: t }, replace: true });

  return (
    <div className="space-y-4">
      <Link to="/admin/general/usuarios" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft size={16} /> Usuarios
      </Link>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="h-14 w-14 rounded-full bg-brand-light text-brand-dark flex items-center justify-center text-lg font-semibold shrink-0">
              {client.fullName
                .split(" ")
                .slice(0, 2)
                .map((p) => p[0])
                .join("")}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold truncate">{client.fullName}</h1>
              <p className="text-sm text-muted-foreground">
                {client.code} · {client.email} · {client.phone}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge tone="neutral">{client.personType === "moral" ? "Persona moral" : "Persona física"}</Badge>
                <KycBadge status={client.kyc.status} />
                {client.membership ? (
                  <Badge tone={client.membership.status === "active" ? "success" : "warn"}>
                    {client.membership.planName} · <span className="ml-1">{client.membership.status === "active" ? "activa" : client.membership.status}</span>
                  </Badge>
                ) : (
                  <Badge tone="neutral">Sin membresía</Badge>
                )}
                {client.loanEligible && <Badge tone="info">Invitado a préstamo</Badge>}
                {FEATURE_DRUO && client.collectionProvider && (
                  <Badge tone="neutral">Cobro por {client.collectionProvider === "druo" ? "Druo" : "Belvo"}</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {mayReview && client.kyc.status !== "verificado" && (
              <BtnPrimary type="button" onClick={() => setDialog("kyc")}>
                <ShieldCheck size={16} /> Revisar identidad
              </BtnPrimary>
            )}
            {mayEdit && (
              <BtnOutline type="button" onClick={() => setDialog("edit")}>
                <PencilLine size={16} /> Editar
              </BtnOutline>
            )}
            {mayEdit && (
              <BtnOutline type="button" onClick={() => setDialog("membership")}>
                <Crown size={16} /> Asignar membresía
              </BtnOutline>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === k
                ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "resumen" && <ResumenTab client={client} onExec={() => setDialog("exec")} goTo={setTab} />}
      {tab === "datos" && <DatosTab client={client} onEdit={mayEdit ? () => setDialog("edit") : undefined} />}
      {tab === "documentos" && <DocumentosTab client={client} editable={mayEdit} onReview={mayReview ? () => setDialog("kyc") : undefined} />}
      {tab === "productos" && <ProductosTab client={client} />}
      {tab === "cuentas" && <CuentasTab client={client} />}
      {tab === "movimientos" && <MovimientosTab client={client} />}
      {tab === "historial" && <HistorialTab client={client} />}

      {dialog === "edit" && <EditClientDialog client={client} open onClose={close} />}
      {dialog === "kyc" && <KycReviewDialog client={client} open onClose={close} />}
      {dialog === "membership" && <AssignMembershipDialog client={client} open onClose={close} />}
      {dialog === "exec" && <ExecutiveDialog client={client} open onClose={close} />}
    </div>
  );
}

/* ───────────── Resumen ───────────── */

function ResumenTab({ client, onExec, goTo }: { client: Client; onExec: () => void; goTo: (t: TabKey) => void }) {
  const { data: loans = [] } = useClientLoans(client.id);
  const { data: cards = [] } = useClientCards(client.id);
  const active = loans.filter((l) => l.stage === "activo");
  const owed = active.reduce((s, l) => s + Math.max(0, l.totalToPay - l.paidAmount), 0);
  const overdue = active.filter((l) => l.daysOverdue > 0);
  const { profile } = useAuth();
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <SectionCard title="Situación" className="xl:col-span-2">
        <DetailGrid
          cols={3}
          items={[
            { label: "Identidad", value: <KycBadge status={client.kyc.status} /> },
            { label: "Membresía", value: client.membership ? `${client.membership.planName} · vence ${date(client.membership.expiresAt)}` : "Sin membresía" },
            { label: "Préstamos activos", value: `${active.length} · ${money(owed)} por cobrar` },
            { label: "Cuotas atrasadas", value: overdue.length ? <span className="text-red-600 font-semibold">{overdue.length} préstamo(s)</span> : "Ninguna" },
            ...(FEATURE_CARDS ? [{ label: "Tarjetas", value: cards.length ? `${cards.length} · ${money(cards.reduce((s, c) => s + c.balance, 0))} saldo` : "Sin tarjeta" }] : []),
            { label: "Alta", value: date(client.createdAt) },
          ]}
        />
        {client.kyc.status === "rechazado" && client.kyc.reasonMessage && (
          <div className="mt-4">
            <InfoNote>
              <strong>Identidad rechazada ({client.kyc.reasonCode}).</strong> Mensaje enviado: “{client.kyc.reasonMessage}”
            </InfoNote>
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-5">
          <BtnOutline type="button" onClick={() => goTo("productos")}>
            <Landmark size={16} /> Ver productos
          </BtnOutline>
          <BtnOutline type="button" onClick={() => goTo("movimientos")}>
            Ver movimientos
          </BtnOutline>
        </div>
      </SectionCard>
      <SectionCard
        title="Ejecutivo"
        action={
          can(profile?.role, "clientes", "editar") ? (
            <button type="button" onClick={onExec} className="text-xs font-semibold text-brand inline-flex items-center gap-1">
              <UserCheck size={14} /> Cambiar
            </button>
          ) : undefined
        }
      >
        <p className="text-sm font-medium">{client.executiveName ?? "Registro directo"}</p>
        <p className="text-xs text-muted-foreground mt-1">Quién dio de alta al cliente (atribución de ventas).</p>
        <div className="mt-4 border-t pt-4">
          <p className="text-xs text-muted-foreground">Préstamo por invitación</p>
          <p className="text-sm mt-0.5">{client.loanEligible ? "Puede ver la opción de préstamo en su app." : "No ve la opción de préstamo."}</p>
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────── Datos ───────────── */

function DatosTab({ client, onEdit }: { client: Client; onEdit?: () => void }) {
  const a = client.addressParts;
  const hasParts = Object.values(a).some(Boolean);
  return (
    <div className="space-y-4">
      <SectionCard
        title="Datos personales"
        action={
          onEdit && (
            <button type="button" onClick={onEdit} className="text-xs font-semibold text-brand inline-flex items-center gap-1">
              <PencilLine size={14} /> Editar
            </button>
          )
        }
      >
        <DetailGrid
          cols={3}
          items={[
            { label: client.personType === "moral" ? "Razón social" : "Nombre(s)", value: client.firstName },
            { label: client.personType === "moral" ? "Régimen" : "Apellidos", value: client.lastName },
            { label: "Tipo", value: client.personType === "moral" ? "Persona moral" : "Persona física" },
            { label: "Correo", value: client.email },
            { label: "Teléfono", value: client.phone },
            { label: client.personType === "moral" ? "Constitución" : "Nacimiento", value: date(client.birthDate) },
            { label: "RFC", value: <span className="font-mono">{client.rfc || "—"}</span> },
            { label: "CURP", value: client.curp ? <span className="font-mono">{client.curp}</span> : "No capturado (opcional)" },
            { label: "Clave INE", value: <span className="font-mono">{client.ineKey || "—"}</span> },
          ]}
        />
      </SectionCard>
      <SectionCard title="Domicilio">
        {hasParts ? (
          <DetailGrid
            cols={3}
            items={[
              { label: "Calle y número", value: [a.calle, a.numero].filter(Boolean).join(" ") },
              { label: "Colonia", value: a.colonia },
              { label: "Ciudad", value: a.ciudad },
              { label: "Estado", value: a.estado },
              { label: "Código postal", value: a.cp },
              { label: "País", value: a.pais ?? "México" },
            ]}
          />
        ) : (
          <div className="space-y-3">
            <p className="text-sm">{client.address || "Sin domicilio capturado."}</p>
            <InfoNote>Este domicilio se capturó en un solo campo. Edítalo para guardarlo desglosado (calle, colonia, ciudad, estado y CP).</InfoNote>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ───────────── Documentos ───────────── */

function DocumentosTab({ client, editable, onReview }: { client: Client; editable: boolean; onReview?: () => void }) {
  const keys: DocumentKey[] = ["ineFrontUrl", "ineBackUrl", "rfcUrl", "addressProofUrl", "curpUrl", "selfieUrl", "contractUrl"];
  return (
    <SectionCard
      title="Identidad y documentos"
      description="El admin puede subir o reemplazar cualquier documento en nombre del cliente."
      action={
        onReview && (
          <BtnPrimary type="button" onClick={onReview} className="h-8 px-3 text-xs">
            <ShieldCheck size={14} /> Revisar identidad
          </BtnPrimary>
        )
      }
    >
      <div className="flex items-center gap-2 mb-4 text-sm">
        <span className="text-muted-foreground">Estatus:</span>
        <KycBadge status={client.kyc.status} />
        {client.kyc.reviewedAt && (
          <span className="text-xs text-muted-foreground">
            · revisado {dateTime(client.kyc.reviewedAt)} por {client.kyc.reviewedBy ?? "—"}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {keys.map((k) => (
          <DocumentTile key={k} client={client} docKey={k} editable={editable} />
        ))}
      </div>
    </SectionCard>
  );
}

/* ───────────── Productos ───────────── */

function LoanCard({ loan }: { loan: Loan }) {
  const [showSchedule, setShowSchedule] = useState(loan.stage === "activo");
  const { data: schedule } = useSchedule(showSchedule ? loan : null);
  const st = loanStatusLabel(loan);
  return (
    <div className="border border-border rounded-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs">{loan.folio}</span>
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
          <div className="text-sm mt-1">
            {money(loan.amount)} · {loan.installments} cuotas de {money(loan.monthlyPayment)} · pagadas {loan.paidInstallments}/{loan.installments}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="text-xs font-semibold text-brand" onClick={() => setShowSchedule((v) => !v)}>
            {showSchedule ? "Ocultar cronograma" : "Ver cronograma"}
          </button>
          <LoanActions loan={loan} />
        </div>
      </div>
      {showSchedule && schedule && (
        <div className="px-4 pb-4">
          <InstallmentsTable rows={schedule.installments} />
        </div>
      )}
    </div>
  );
}

function ProductosTab({ client }: { client: Client }) {
  const { data: subs = [] } = useClientSubscriptions(client.id);
  const { data: loans = [] } = useClientLoans(client.id);
  const { data: cards = [] } = useClientCards(client.id);
  return (
    <div className="space-y-4">
      <SectionCard title="Membresía">
        {subs.length === 0 ? (
          <p className="text-sm text-muted-foreground">El cliente aún no compra una membresía. La compra después de registrarse desde su app.</p>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Plan</th>
                  <th className="px-3 py-2 text-left font-semibold">Estatus</th>
                  <th className="px-3 py-2 text-left font-semibold">Inicio</th>
                  <th className="px-3 py-2 text-left font-semibold">Vence</th>
                  <th className="px-3 py-2 text-right font-semibold">Precio</th>
                  <th className="px-3 py-2 text-left font-semibold">Renovación</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{s.planName}</td>
                    <td className="px-3 py-2">
                      <SubscriptionBadge status={s.status} />
                    </td>
                    <td className="px-3 py-2">{date(s.startedAt)}</td>
                    <td className="px-3 py-2">{date(s.expiresAt)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(s.price)}</td>
                    <td className="px-3 py-2">{s.autoRenew ? "Automática" : "Manual"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Préstamos" description="Con su cronograma de cuotas y las mismas acciones de Préstamos › Gestión.">
        {loans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {client.loanEligible ? "Invitado a préstamo; aún no ha solicitado." : "Sin préstamos. Los préstamos son por invitación."}
          </p>
        ) : (
          <div className="space-y-3">
            {loans.map((l) => (
              <LoanCard key={l.id} loan={l} />
            ))}
          </div>
        )}
      </SectionCard>

      {FEATURE_CARDS && (
        <SectionCard title="Tarjetas" description="OneCard · Fase 2 (datos de ejemplo hasta la integración).">
          {cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin tarjeta. Requiere membresía activa e identidad verificada.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cards.map((c) => (
                <div key={c.id} className="rounded-lg border border-border p-4 flex items-center gap-4">
                  <div className="h-12 w-20 rounded-md bg-gradient-to-br from-brand-navy to-brand-accent text-white flex items-end justify-end p-1.5 text-[10px] font-mono">
                    •••• {c.lastDigits}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CreditCard size={14} />
                      <span className="text-sm font-medium">{c.kind === "fisica" ? "Física" : "Virtual"}</span>
                      <CardStatusBadge status={c.status} />
                    </div>
                    <div className="text-sm mt-1">
                      Saldo <strong className="tabular-nums">{money(c.balance)}</strong> · línea {money(c.creditLine)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}

/* ───────────── Cuentas ───────────── */

function CuentasTab({ client }: { client: Client }) {
  const { data = [], isLoading } = useBankAccounts(client.id);
  return (
    <SectionCard title="Cuentas y medios de pago" description="Cuenta domiciliada (CLABE) y tarjetas guardadas para el pago de la membresía.">
      {isLoading ? null : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin cuentas registradas.</p>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                <th className="px-3 py-2 text-left font-semibold">Banco / emisor</th>
                <th className="px-3 py-2 text-left font-semibold">Número</th>
                <th className="px-3 py-2 text-left font-semibold">Validación</th>
                {FEATURE_DRUO && <th className="px-3 py-2 text-left font-semibold">Cobro por</th>}
                <th className="px-3 py-2 text-left font-semibold">Predeterminada</th>
                <th className="px-3 py-2 text-left font-semibold">Registro</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{a.kind === "cuenta" ? "Cuenta (CLABE)" : "Tarjeta"}</td>
                  <td className="px-3 py-2">{a.bankName}</td>
                  <td className="px-3 py-2 font-mono text-xs">{a.kind === "cuenta" ? maskClabe(a.clabe) : `•••• ${a.lastDigits}`}</td>
                  <td className="px-3 py-2">
                    <Badge tone={a.validationStatus === "validated" ? "success" : "warn"}>{a.validationStatus === "validated" ? "Validada" : "Pendiente"}</Badge>
                  </td>
                  {FEATURE_DRUO && <td className="px-3 py-2">{a.provider === "druo" ? "Druo" : a.provider === "belvo" ? "Belvo" : "—"}</td>}
                  <td className="px-3 py-2">{a.isDefault ? "Sí" : "—"}</td>
                  <td className="px-3 py-2">{date(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {FEATURE_DRUO && (
        <div className="mt-4">
          <InfoNote>Regla de enrutamiento: cuentas BBVA Bancomer se cobran por Druo; el resto de bancos por Belvo. El cliente no ve esta diferencia.</InfoNote>
        </div>
      )}
    </SectionCard>
  );
}

/* ───────────── Movimientos ───────────── */

type MovRow = Movement & { typeLabel: string; statusLabel: string; providerLabel: string };

function MovimientosTab({ client }: { client: Client }) {
  const { data = [], isLoading } = useClientMovements(client.id, client.fullName);
  const rows: MovRow[] = data.map((m) => ({
    ...m,
    typeLabel: MOVEMENT_TYPE_LABEL[m.type],
    statusLabel: MOVEMENT_STATUS_LABEL[m.status],
    providerLabel: PROVIDER_LABEL[m.provider],
  }));
  const cols: Column<MovRow>[] = [
    { key: "date", label: "Fecha", sortable: true, filterable: "date", minWidth: 110, render: (r) => dateTime(r.date) },
    { key: "typeLabel", label: "Tipo", filterable: "enum", filterOptions: Array.from(new Set(rows.map((r) => r.typeLabel))), minWidth: 160, render: (r) => r.typeLabel },
    { key: "description", label: "Descripción", filterable: true, minWidth: 200, maxWidth: 280, render: (r) => r.description },
    {
      key: "amount",
      label: "Monto",
      sortable: true,
      minWidth: 110,
      render: (r) => <span className={`tabular-nums ${r.direction === "salida" ? "text-red-600" : ""}`}>{r.direction === "salida" ? "−" : ""}{money(r.amount)}</span>,
    },
    { key: "statusLabel", label: "Estatus", filterable: "enum", filterOptions: Object.values(MOVEMENT_STATUS_LABEL), minWidth: 110, render: (r) => <MovementStatusBadge status={r.status} label={r.statusLabel} /> },
    { key: "providerLabel", label: "Proveedor", minWidth: 100, render: (r) => r.providerLabel },
    { key: "reference", label: "Referencia", filterable: true, minWidth: 130, render: (r) => <span className="font-mono text-xs">{r.reference}</span> },
  ];
  return <DataTable columns={cols} data={rows} loading={isLoading} keyExtractor={(r) => r.id} emptyMessage="Sin movimientos." />;
}

/* ───────────── Historial ───────────── */

function HistorialTab({ client }: { client: Client }) {
  const { data: byId = [] } = useEntityActivity(client.id);
  const { data: byCode = [] } = useEntityActivity(client.code);
  const rows = [...byId, ...byCode].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <SectionCard title="Historial de cambios" description="Quién hizo qué y cuándo sobre este cliente.">
      <SampleDataNotice force>
        La bitácora se guarda de forma permanente cuando el backend cree la tabla de actividad. Mientras tanto se registra durante la sesión.
      </SampleDataNotice>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>
      ) : (
        <ol className="relative border-l border-border ml-2 space-y-4">
          {rows.map((a) => (
            <li key={a.id} className="ml-4">
              <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-brand-accent" />
              <div className="text-sm">
                <strong>{a.user}</strong> · {a.action}
              </div>
              <div className="text-xs text-muted-foreground">
                {dateTime(a.at)} {a.detail ? `· ${a.detail}` : ""}
              </div>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
