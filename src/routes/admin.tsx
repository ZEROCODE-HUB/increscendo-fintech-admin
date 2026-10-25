import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import {
  Activity,
  BadgeCheck,
  BookOpen,
  Cable,
  CreditCard,
  Crown,
  FileBarChart2,
  HandCoins,
  Inbox,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Settings,
  Shield,
  ShieldAlert,
  Tag,
  TerminalSquare,
  UserCog,
  Users,
  Wallet,
  BellRing,
  Library,
  Layers,
} from "lucide-react";
import { PortalShell, type NavItem, type NavLeaf } from "@/components/portal-shell";
import { RouteSkeleton } from "@/components/route-skeleton";
import { useAuth } from "@/lib/auth";
import { can, type Resource } from "@/lib/permissions";
import { setActivityUser } from "@/lib/api/activity";
import { FEATURE_CARDS } from "@/lib/feature-flags";
import { usePending } from "@/hooks/queries";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  pendingComponent: RouteSkeleton,
});

type Leaf = NavLeaf & { resource: Resource };
type Group = { label: string; icon: NavLeaf["icon"]; items: Leaf[] };

function buildNav(pendingCount: number): (Leaf | Group)[] {
  const nav: (Leaf | Group)[] = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, resource: "dashboard" },
    {
      label: "General",
      icon: Activity,
      items: [
        { to: "/admin/general/usuarios", label: "Usuarios", icon: Users, resource: "clientes" },
        { to: "/admin/general/movimientos", label: "Movimientos", icon: Activity, resource: "movimientos" },
        { to: "/admin/general/pendientes", label: "Pendientes", icon: Inbox, resource: "pendientes", badge: pendingCount },
      ],
    },
    {
      label: "Préstamos",
      icon: Landmark,
      items: [
        { to: "/admin/prestamos/gestion", label: "Gestión", icon: ListChecks, resource: "prestamos" },
        { to: "/admin/prestamos/cobranza", label: "Cobranza", icon: HandCoins, resource: "prestamos" },
      ],
    },
    {
      label: "Membresías",
      icon: Crown,
      items: [
        { to: "/admin/membresias/suscripciones", label: "Suscripciones", icon: BadgeCheck, resource: "membresias" },
        { to: "/admin/membresias/planes", label: "Planes y beneficios", icon: Layers, resource: "membresias" },
        { to: "/admin/membresias/cupones", label: "Cupones", icon: Tag, resource: "membresias.planes" },
      ],
    },
  ];
  if (FEATURE_CARDS) {
    nav.push({
      label: "Tarjetas · Fase 2",
      icon: CreditCard,
      items: [
        { to: "/admin/tarjetas/campanas", label: "Campañas", icon: Megaphone, resource: "tarjetas" },
        { to: "/admin/tarjetas/solicitudes", label: "Solicitudes", icon: ListChecks, resource: "tarjetas" },
        { to: "/admin/tarjetas/activas", label: "Activas", icon: CreditCard, resource: "tarjetas" },
        { to: "/admin/tarjetas/reportadas", label: "Reportadas", icon: ShieldAlert, resource: "tarjetas" },
        { to: "/admin/tarjetas/cuenta-maestra", label: "Cuenta Maestra", icon: Wallet, resource: "tarjetas.saldo" },
        { to: "/admin/tarjetas/operaciones", label: "Operaciones", icon: TerminalSquare, resource: "tarjetas.operaciones" },
      ],
    });
  }
  nav.push(
    {
      label: "Administración",
      icon: Shield,
      items: [
        { to: "/admin/administracion/usuarios", label: "Usuarios backoffice", icon: UserCog, resource: "backoffice" },
        { to: "/admin/administracion/reportes", label: "Reportes", icon: FileBarChart2, resource: "reportes" },
        { to: "/admin/administracion/registros", label: "Registros", icon: BookOpen, resource: "registros" },
      ],
    },
    {
      label: "Sistema",
      icon: Settings,
      items: [
        { to: "/admin/sistema/integraciones", label: "Integraciones", icon: Cable, resource: "sistema" },
        { to: "/admin/sistema/notificaciones", label: "Notificaciones", icon: BellRing, resource: "sistema" },
        { to: "/admin/sistema/catalogos", label: "Catálogos", icon: Library, resource: "sistema" },
      ],
    },
  );
  return nav;
}

function AdminLayout() {
  const { loading, profile } = useAuth();
  const navigate = useNavigate();
  const { data: pending = [] } = usePending();

  useEffect(() => {
    if (!loading && !profile) navigate({ to: "/" });
  }, [loading, profile, navigate]);

  useEffect(() => {
    if (profile) setActivityUser(profile.fullName);
  }, [profile]);

  const nav: NavItem[] = useMemo(() => {
    const role = profile?.role;
    const allowed = (l: Leaf) => can(role, l.resource, "ver");
    return buildNav(pending.length)
      .map((item) => ("items" in item ? { ...item, items: item.items.filter(allowed) } : item))
      .filter((item) => ("items" in item ? item.items.length > 0 : allowed(item as Leaf)));
  }, [profile?.role, pending.length]);

  if (loading || !profile) return <RouteSkeleton />;

  return (
    <PortalShell nav={nav} title="Backoffice">
      <Outlet />
    </PortalShell>
  );
}
