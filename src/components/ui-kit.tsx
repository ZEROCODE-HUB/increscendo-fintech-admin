import type {
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Link } from "@tanstack/react-router";
import { FlaskConical, Info } from "lucide-react";
import { Badge, type BadgeTone } from "./portal-shell";
import { Portal } from "./portal";
import type {
  CardStatus,
  KycStatus,
  MovementStatus,
  SubscriptionStatus,
} from "@/lib/api/types";
import { isDemoMode } from "@/lib/api/source";

/** Aviso visible cuando una sección usa datos de ejemplo (sin tabla/endpoint en backend). */
export function SampleDataNotice({
  children,
  force = false,
}: {
  children?: ReactNode;
  force?: boolean;
}) {
  if (!force && !isDemoMode) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 mb-3">
      <FlaskConical size={14} className="mt-0.5 shrink-0" />
      <span>
        {children ??
          "Datos de ejemplo. Esta sección se conecta a datos reales cuando el backend implemente su contrato (docs/CONTRATOS_BACKEND.md)."}
      </span>
    </div>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-brand-cyan/30 bg-brand-cyan-light px-3 py-2 text-xs text-brand-navy">
      <Info size={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-card border border-border rounded-xl ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-2 px-5 pt-4 pb-3 border-b border-border">
          <div>
            {title && (
              <h2 className="font-display text-sm font-semibold text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function DetailGrid({
  items,
  cols = 3,
}: {
  items: { label: string; value: ReactNode }[];
  cols?: 2 | 3 | 4;
}) {
  const grid =
    cols === 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : cols === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <dl className={`grid grid-cols-1 ${grid} gap-x-6 gap-y-3`}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {it.label}
          </dt>
          <dd className="text-sm text-foreground mt-0.5 break-words">
            {it.value || it.value === 0 ? it.value : "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function FieldLabel({
  children,
  htmlFor,
  hint,
}: {
  children: ReactNode;
  htmlFor?: string;
  hint?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-xs font-semibold text-foreground mb-1.5 block"
    >
      {children}
      {hint && (
        <span className="ml-1 font-normal text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}

export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...p}
      className={`w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 ${p.className ?? ""}`}
    />
  );
}

export function Textarea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...p}
      className={`w-full min-h-20 px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 ${p.className ?? ""}`}
    />
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin ${className}`}
    />
  );
}

/** Overlay de proceso largo (p. ej. aprobar: estatus + SignNow + correo). */
export function ProcessingOverlay({
  open,
  title,
  message,
}: {
  open: boolean;
  title: string;
  message: string;
}) {
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
        <div className="bg-card rounded-xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </Portal>
  );
}

const KYC: Record<KycStatus, [string, BadgeTone]> = {
  incompleto: ["Incompleta", "neutral"],
  por_verificar: ["Por verificar", "warn"],
  verificado: ["Verificada", "success"],
  rechazado: ["Rechazada", "danger"],
};
export const KYC_LABEL: Record<KycStatus, string> = Object.fromEntries(
  Object.entries(KYC).map(([k, v]) => [k, v[0]]),
) as Record<KycStatus, string>;
export function KycBadge({ status }: { status: KycStatus }) {
  const [label, tone] = KYC[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const SUB: Record<SubscriptionStatus, [string, BadgeTone]> = {
  active: ["Activa", "success"],
  expired: ["Vencida", "neutral"],
  pending: ["Pago pendiente", "warn"],
  cancelled: ["Cancelada", "danger"],
};
export const SUBSCRIPTION_LABEL: Record<SubscriptionStatus, string> =
  Object.fromEntries(Object.entries(SUB).map(([k, v]) => [k, v[0]])) as Record<
    SubscriptionStatus,
    string
  >;
export function SubscriptionBadge({ status }: { status: SubscriptionStatus }) {
  const [label, tone] = SUB[status] ?? [status, "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}

const MOV: Record<MovementStatus, BadgeTone> = {
  exitoso: "success",
  en_proceso: "info",
  fallido: "danger",
  cancelado: "neutral",
  reembolsado: "warn",
};
export function MovementStatusBadge({
  status,
  label,
}: {
  status: MovementStatus;
  label: string;
}) {
  return <Badge tone={MOV[status]}>{label}</Badge>;
}

const CARD: Record<CardStatus, [string, BadgeTone]> = {
  activa: ["Activa", "success"],
  bloqueada: ["Bloqueada (admin)", "danger"],
  bloqueo_temporal: ["Bloqueo temporal", "warn"],
  reportada: ["Reportada", "danger"],
  reemplazada: ["Reemplazada", "neutral"],
  pendiente_entrega: ["Por entregar", "info"],
};
export const CARD_STATUS_LABEL: Record<CardStatus, string> = Object.fromEntries(
  Object.entries(CARD).map(([k, v]) => [k, v[0]]),
) as Record<CardStatus, string>;
export function CardStatusBadge({ status }: { status: CardStatus }) {
  const [label, tone] = CARD[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function ClientLink({ id, name }: { id: string | null; name: string }) {
  if (!id) return <span>{name}</span>;
  return (
    <Link
      to="/admin/general/usuarios/$id"
      params={{ id }}
      className="text-foreground font-medium hover:text-brand underline-offset-2 hover:underline"
    >
      {name}
    </Link>
  );
}
