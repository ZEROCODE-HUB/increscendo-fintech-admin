import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LogIn, Eye, EyeOff, Mail, Lock, ShieldCheck, AlertCircle } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { supabase, getAuthErrorMessage } from "@/lib/supabase";
import { loadAdminProfile } from "@/lib/auth";
import { isDemoMode } from "@/lib/api/source";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Panel de Administración — Increscendo Fintech" },
      { name: "description", content: "Acceso al backoffice de Increscendo Fintech." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isDemoMode || !supabase) {
      // Sin Supabase configurado el panel abre en modo demostración.
      navigate({ to: "/admin" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setError(getAuthErrorMessage(error?.message ?? ""));
      setLoading(false);
      return;
    }
    const profile = await loadAdminProfile(data.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      setError("Tu cuenta no tiene acceso al panel de administración.");
      setLoading(false);
      return;
    }
    navigate({ to: "/admin" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden select-none">
      {/* Brand background: mesh gradient + orbs + grain */}
      <div aria-hidden className="login-surface absolute inset-0 overflow-hidden">
        {/* Base: gradiente oscuro del login del cliente */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(150deg, #070f1c 0%, #0d1a2e 38%, #13213a 68%, #123a40 100%)" }}
        />
        <div
          className="login-orb -left-[14%] -top-[16%] h-[42rem] w-[42rem]"
          style={{
            background:
              "radial-gradient(circle, rgba(60,90,134,0.5) 0%, rgba(60,90,134,0) 68%)",
          }}
        />
        <div
          className="login-orb login-orb-b -right-[16%] top-[4%] h-[38rem] w-[38rem]"
          style={{
            background:
              "radial-gradient(circle, rgba(31,165,196,0.26) 0%, rgba(31,165,196,0) 68%)",
          }}
        />
        <div
          className="login-orb login-orb-c -bottom-[22%] left-[24%] h-[40rem] w-[40rem]"
          style={{
            background:
              "radial-gradient(circle, rgba(43,66,100,0.45) 0%, rgba(43,66,100,0) 70%)",
          }}
        />
        <div className="login-grain absolute inset-0" />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-40 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(4,9,17,0) 26%, rgba(4,9,17,0.66) 100%)",
          }}
        />
        {/* Círculos definidos (por encima de la viñeta) */}
        <LoginRings />
      </div>

      <div className="w-full max-w-[400px] relative">
        {/* Logo + title */}
        <div className="login-enter text-center mb-10">
          <div className="flex justify-center mb-4">
            <BrandLogo size={52} variant="light" />
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-white tracking-tight">
            Panel de Administración
          </h1>
          <p className="text-base text-white/60 mt-2">Inicia sesión para continuar.</p>
          {isDemoMode && (
            <p className="mt-3 inline-block rounded-md bg-amber-400/90 px-2.5 py-1 text-[11px] font-semibold text-navy-700">
              Modo demostración: entra con cualquier correo y contraseña.
            </p>
          )}
        </div>

        {/* Glass card */}
        <div
          className="login-enter login-enter-delay-1 rounded-2xl p-8 relative overflow-hidden"
          style={{
            background: "rgba(255, 255, 255, 0.58)",
            backdropFilter: "blur(32px)",
            WebkitBackdropFilter: "blur(32px)",
            border: "1px solid rgba(31, 165, 196, 0.45)",
            boxShadow:
              "0 24px 64px rgba(3, 10, 20, 0.45), 0 0 0 1px rgba(31, 165, 196, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.35)",
          }}
        >
          {/* Cyan edge accent */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(31, 165, 196, 0.9), transparent)",
            }}
          />
          {/* Light reflection highlight */}
          <div
            aria-hidden
            className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-30 pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%)",
            }}
          />
          <div
            aria-hidden
            className="absolute -bottom-16 -left-16 w-32 h-32 rounded-full opacity-20 pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)",
            }}
          />
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-foreground mb-1.5">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@increscendofintech.com"
                  required={!isDemoMode}
                  autoComplete="email"
                  className="w-full h-11 pl-9 pr-3.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-200 focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-foreground mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                />
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  required={!isDemoMode}
                  autoComplete="current-password"
                  className="w-full h-11 pl-9 pr-10 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-200 focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition cursor-pointer"
                  aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all duration-200 hover:bg-brand-dark active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={16} />
                  Iniciar sesión
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-4 pt-4 border-t border-gray-100">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted">
              <ShieldCheck size={12} className="text-brand-navy" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-navy">
                Acceso restringido al equipo
              </span>
            </div>
            <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
              Solo administradores autorizados.
              <br />
              Increscendo Fintech &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginRings() {
  // anillos-v4: más definidos, con acento cian en el anillo externo superior
  const ring = (size: number, pos: React.CSSProperties, color: string, fill = 0) => (
    <div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        border: `1px solid ${color}`,
        background: fill ? `rgba(255,255,255,${fill})` : undefined,
        ...pos,
      }}
    />
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute rounded-full" style={{ width: 520, height: 520, right: -160, top: -170, background: "rgba(31,165,196,0.16)", filter: "blur(110px)" }} />
      <div className="absolute rounded-full" style={{ width: 440, height: 440, left: -140, bottom: -150, background: "rgba(35,149,126,0.18)", filter: "blur(110px)" }} />
      {ring(640, { right: -260, top: -260, boxShadow: "0 0 40px rgba(31,165,196,0.08)" }, "rgba(95,211,236,0.24)")}
      {ring(440, { right: -160, top: -160 }, "rgba(255,255,255,0.15)")}
      {ring(250, { right: -70, top: -70 }, "rgba(255,255,255,0.12)", 0.02)}
      {ring(520, { left: -260, bottom: -260 }, "rgba(255,255,255,0.14)")}
      {ring(320, { left: -150, bottom: -150 }, "rgba(255,255,255,0.12)")}
    </div>
  );
}
