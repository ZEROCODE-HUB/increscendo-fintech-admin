import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { isDemoMode } from "@/lib/api/source";
import type { BackofficeRole } from "@/lib/api/types";
import { ROLE_LABEL } from "@/lib/roles";

export type AdminProfile = {
  id: string;
  email: string;
  fullName: string;
  role: BackofficeRole;
  roleLabel: string;
};

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  /** Perfil del usuario backoffice. null si no tiene acceso al panel. */
  profile: AdminProfile | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_PROFILE: AdminProfile = {
  id: "demo-admin",
  email: "hector@increscendofintech.com",
  fullName: "Héctor Gállego",
  role: "admin",
  roleLabel: ROLE_LABEL.admin,
};

/**
 * Resuelve el rol de backoffice a partir de la tabla `users` de Increscendo.
 * Hoy: `users.role = 'admin'` → Administrador.
 * Con roles nuevos: `users.metadata.backoffice_role` (operaciones, agente, cobranza…).
 */
export async function loadAdminProfile(userId: string): Promise<AdminProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("users")
    .select("id, email, first_name, last_name, role, metadata")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const meta = (data.metadata ?? {}) as Record<string, unknown>;
  const boRole = meta.backoffice_role as BackofficeRole | undefined;
  const role: BackofficeRole | null = boRole ?? (data.role === "admin" ? "admin" : null);
  if (!role) return null;
  return {
    id: data.id,
    email: data.email ?? "",
    fullName: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || (data.email ?? ""),
    role,
    roleLabel: ROLE_LABEL[role],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(isDemoMode ? DEMO_PROFILE : null);
  const [loading, setLoading] = useState(!isDemoMode);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const load = async (s: Session | null) => {
      setSession(s);
      if (!s?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const p = await loadAdminProfile(s.user.id);
        if (active) setProfile(p);
      } finally {
        if (active) setLoading(false);
      }
    };
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => void load(s));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    if (!isDemoMode) setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ loading, session, profile, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
