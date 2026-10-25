import { Portal } from "./portal";
import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { BtnPrimary, BtnOutline } from "./portal-shell";

export function FormDialog({
  open,
  onClose,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Crear",
  size = "md",
  hideCancel = false,
  cancelLabel = "Cancelar",
  isSubmitting = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  size?: "md" | "lg" | "xl" | "2xl";
  hideCancel?: boolean;
  cancelLabel?: string;
  isSubmitting?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const w =
    size === "2xl"
      ? "max-w-5xl"
      : size === "xl"
        ? "max-w-4xl"
        : size === "lg"
          ? "max-w-2xl"
          : "max-w-md";
  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
          <form
            className="p-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            {children}
            <div className="flex gap-2 pt-2">
              {!hideCancel && (
                <BtnOutline
                  type="button"
                  className="flex-1"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  {cancelLabel}
                </BtnOutline>
              )}
              <BtnPrimary
                type="submit"
                className="flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting && (
                  <span className="inline-block w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                )}
                {submitLabel}
              </BtnPrimary>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
