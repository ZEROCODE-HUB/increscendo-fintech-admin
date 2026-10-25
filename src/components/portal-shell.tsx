import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Menu,
  LogOut,
  MoreHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { BrandLogo } from "./brand-logo";
import { useAuth } from "@/lib/auth";
import { isDemoMode } from "@/lib/api/source";

export type NavLeaf = { to: string; label: string; icon: LucideIcon; badge?: number };
export type NavGroup = { label: string; icon: LucideIcon; items: NavLeaf[] };
export type NavItem = NavLeaf | NavGroup;

const isGroup = (item: NavItem): item is NavGroup => (item as NavGroup).items !== undefined;

const flattenLeaves = (nav: NavItem[]): NavLeaf[] =>
  nav.flatMap((i) => (isGroup(i) ? i.items : [i]));

const isActive = (to: string, path: string, leaves: NavLeaf[]): boolean => {
  if (path === to) return true;
  if (path === `${to}/`) return true;
  if (to !== "/admin" && path.startsWith(`${to}/`)) {
    const overridden = leaves.some(
      (other) => other.to !== to && other.to.startsWith(`${to}/`) && path.startsWith(other.to),
    );
    return !overridden;
  }
  return false;
};

export function PortalShell({
  nav,
  title,
  children,
}: {
  nav: NavItem[];
  title: string;
  children: ReactNode;
}) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const displayName = profile?.fullName || profile?.email || "Administrador";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "AD";

  const leaves = useMemo(() => flattenLeaves(nav), [nav]);
  const mainNav = leaves.slice(0, 4);
  const more = leaves.slice(4);

  const onLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header superior */}
      <header className="h-14 border-b border-black-100 bg-white flex items-center justify-between px-4 lg:px-6 shrink-0">
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden p-2 -ml-2 text-black-600 hover:text-black-800"
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <BrandLogo size={30} />
          <span className="hidden md:inline text-sm text-black-400 border-l border-black-100 pl-3 ml-1">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isDemoMode && (
            <span
              className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
              title="Supabase no está configurado: el panel muestra datos de ejemplo."
            >
              Modo demostración
            </span>
          )}
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-xs text-black-400">{profile?.roleLabel ?? "Sesión"}</span>
            <span className="text-sm font-semibold text-black-700 max-w-[200px] truncate">{displayName}</span>
          </div>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold bg-brand-light text-brand-dark">
            {initials}
          </div>
          <button
            onClick={onLogout}
            className="hidden md:inline-flex items-center gap-1 text-xs text-black-400 hover:text-black-700 transition-colors"
          >
            <LogOut size={14} /> Salir
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar desktop */}
        <aside
          className={`hidden lg:flex flex-col border-r border-navy-600 bg-sidebar-bg shrink-0 transition-[width] duration-200 ${
            collapsed ? "w-16 min-w-16" : "w-60"
          }`}
        >
          <div
            className={`flex items-center shrink-0 border-b border-navy-600 ${
              collapsed ? "justify-center py-2" : "justify-between px-3 h-11"
            }`}
          >
            {!collapsed && (
              <span className="text-xs font-semibold uppercase tracking-wider text-white/60 truncate">
                Navegación
              </span>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="p-2 rounded-sm text-white/60 hover:text-white hover:bg-navy-600 transition-colors"
              title={collapsed ? "Expandir menú" : "Minimizar menú"}
              aria-label={collapsed ? "Expandir menú" : "Minimizar menú"}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
          <nav className="p-3 flex-1 overflow-y-auto">
            <SidebarNav nav={nav} path={path} collapsed={collapsed} />
          </nav>
        </aside>

        {/* Drawer mobile */}
        {open && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar-bg border-r border-navy-600 flex flex-col">
              <div className="p-4 border-b border-navy-600">
                <BrandLogo size={30} variant="light" />
              </div>
              <nav className="p-3 flex-1 overflow-y-auto">
                <SidebarNav nav={nav} path={path} onNavigate={() => setOpen(false)} />
              </nav>
            </aside>
          </div>
        )}

        {/* Main */}
        <main className="flex-1 min-w-0 overflow-y-auto pb-20 lg:pb-6">
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:px-10 lg:pt-5 lg:pb-8">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 h-16 bg-white border-t border-black-100 flex items-stretch z-30">
        {mainNav.map((item) => {
          const active = isActive(item.to, path, leaves);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] ${
                active ? "text-brand-accent font-semibold" : "text-black-400"
              }`}
            >
              <Icon size={20} strokeWidth={1.75} />
              <span className="truncate px-1">{item.label}</span>
            </Link>
          );
        })}
        {more.length > 0 && (
          <button
            onClick={() => setOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] text-black-400"
          >
            <MoreHorizontal size={20} strokeWidth={1.75} />
            <span>Más</span>
          </button>
        )}
      </nav>
    </div>
  );
}

function SidebarNav({
  nav,
  path,
  collapsed,
  onNavigate,
}: {
  nav: NavItem[];
  path: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const leaves = useMemo(() => flattenLeaves(nav), [nav]);
  if (collapsed) {
    return (
      <>
        {nav.map((item) =>
          isGroup(item) ? (
            item.items.map((leaf) => (
              <SidebarLink
                key={leaf.to}
                item={leaf}
                active={isActive(leaf.to, path, leaves)}
                onNavigate={onNavigate}
                collapsed
              />
            ))
          ) : (
            <SidebarLink
              key={item.to}
              item={item}
              active={isActive(item.to, path, leaves)}
              onNavigate={onNavigate}
              collapsed
            />
          ),
        )}
      </>
    );
  }

  return (
    <>
      {nav.map((item, idx) =>
        isGroup(item) ? (
          <SidebarGroup
            key={`g-${idx}-${item.label}`}
            group={item}
            path={path}
            leaves={leaves}
            onNavigate={onNavigate}
          />
        ) : (
          <SidebarLink
            key={item.to}
            item={item}
            active={isActive(item.to, path, leaves)}
            onNavigate={onNavigate}
          />
        ),
      )}
    </>
  );
}

function SidebarLink({
  item,
  active,
  onNavigate,
  nested = false,
  collapsed = false,
}: {
  item: NavLeaf;
  active: boolean;
  onNavigate?: () => void;
  nested?: boolean;
  collapsed?: boolean;
}) {
  const Icon = item.icon;

  if (collapsed) {
    return (
      <Link
        to={item.to}
        onClick={onNavigate}
        title={item.label}
        aria-label={item.label}
        className={`flex items-center justify-center w-11 h-11 mx-auto mb-1 rounded-lg transition-colors ${
          active
            ? "bg-brand-accent text-white font-semibold"
            : "text-white/80 hover:text-white hover:bg-navy-600"
        }`}
      >
        <Icon size={20} strokeWidth={1.75} />
      </Link>
    );
  }

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={`flex items-center gap-3 px-3 py-2 rounded-sm text-sm mb-0.5 transition-colors ${
        nested ? "pl-9" : ""
      } ${
        nested
          ? active
            ? "bg-brand-accent-dark text-white font-semibold"
            : "text-white/60 hover:text-white hover:bg-navy-600/50"
          : active
            ? "bg-brand-accent text-white font-semibold"
            : "text-white/80 hover:text-white hover:bg-navy-600"
      }`}
    >
      {!nested && <Icon size={18} strokeWidth={1.75} />}
      {nested && <Icon size={15} strokeWidth={1.75} className="opacity-70" />}
      <span className="flex-1 truncate">{item.label}</span>
      {!!item.badge && item.badge > 0 && (
        <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-amber-400 text-[10px] font-bold text-navy-700 inline-flex items-center justify-center">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
    </Link>
  );
}

function SidebarGroup({
  group,
  path,
  leaves,
  onNavigate,
}: {
  group: NavGroup;
  path: string;
  leaves: NavLeaf[];
  onNavigate?: () => void;
}) {
  const containsActive = group.items.some((i) => isActive(i.to, path, leaves));
  const [open, setOpen] = useState(containsActive);
  const Icon = group.icon;
  const expanded = open || containsActive;
  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-colors ${
          containsActive
            ? "text-brand-accent font-semibold"
            : "text-white/80 hover:text-white hover:bg-navy-600"
        }`}
        aria-expanded={expanded}
      >
        <Icon size={18} strokeWidth={1.75} />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="mt-0.5">
          {group.items.map((it) => (
            <SidebarLink
              key={it.to}
              item={it}
              active={isActive(it.to, path, leaves)}
              onNavigate={onNavigate}
              nested
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* Utility primitives used by pages */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
      <div>
        <h1 className="font-display text-xl md:text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-xl p-5 ${className}`}>{children}</div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-display text-xl md:text-2xl font-semibold text-foreground mt-1 tabular-nums">
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

export function BtnPrimary({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold cursor-pointer hover:bg-brand-dark active:bg-brand-darker transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${p.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function BtnOutline({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-border bg-card text-foreground text-sm font-semibold cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${p.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Input(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...p}
      className={`w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-200 focus:border-ring focus:ring-2 focus:ring-ring/20 ${p.className ?? ""}`}
    />
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-semibold text-foreground mb-1.5 block">
      {children}
    </label>
  );
}

export type BadgeTone = "neutral" | "success" | "warn" | "danger" | "info";

const badgeStyles: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground border border-border",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  warn: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  danger: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  info: "bg-brand-cyan-light text-brand-navy dark:bg-sky-950/30 dark:text-sky-300",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
  title,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${badgeStyles[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
