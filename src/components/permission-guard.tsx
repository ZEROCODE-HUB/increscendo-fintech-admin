import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useCan, type Resource } from "@/lib/permissions";

function SinPermiso() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
      <Lock size={28} />
      <p>Tu rol no tiene acceso a esta sección.</p>
    </div>
  );
}

/** Guard de UX. La validación real vive en RLS / backend. */
export function PermissionGuard({ recurso, children }: { recurso: Resource; children: ReactNode }) {
  const allowed = useCan(recurso, "ver");
  if (!allowed) return <SinPermiso />;
  return <>{children}</>;
}
