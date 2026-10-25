import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="text-muted-foreground mb-4">
        {icon ?? <Inbox size={48} strokeWidth={1.5} />}
      </div>
      <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1 max-w-sm text-center">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
