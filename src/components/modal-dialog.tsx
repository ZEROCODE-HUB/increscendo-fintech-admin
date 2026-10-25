import { Portal } from "./portal";
import { type ReactNode } from "react";
import { X } from "lucide-react";

export function ModalDialog({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  if (!open) return null;
  const w =
    size === "lg"
      ? "max-w-2xl"
      : size === "xl"
        ? "max-w-4xl"
        : size === "sm"
          ? "max-w-sm"
          : "max-w-md";
  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div
          className={`relative bg-card rounded-lg w-full ${w} max-h-[90vh] overflow-y-auto shadow-xl`}
        >
          <div className="sticky top-0 bg-card border-b px-6 py-4 flex justify-between items-start z-10">
            <div>
              <h3 className="font-display font-semibold text-lg">{title}</h3>
              {description && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-muted rounded-md"
            >
              <X size={18} />
            </button>
          </div>
          <div className="p-6">{children}</div>
        </div>
      </div>
    </Portal>
  );
}
