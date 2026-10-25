import { Portal } from "./portal";
import { useState } from "react";
import { X } from "lucide-react";
import { BtnPrimary, BtnOutline } from "./portal-shell";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmar",
  variant = "default",
  extraContent,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "default" | "danger";
  extraContent?: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  if (!open) return null;

  const confirmStyles =
    variant === "danger" ? "bg-red-600 hover:bg-red-700 text-white" : "";

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => !loading && onClose()}
        />
        <div className="relative bg-card rounded-lg w-full max-w-sm shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-lg">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="p-1.5 hover:bg-muted rounded-md disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-6">{message}</p>
          {extraContent}
          <div className="flex gap-2">
            <BtnOutline
              type="button"
              className="flex-1"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </BtnOutline>
            <BtnPrimary
              type="button"
              className={`flex-1 ${confirmStyles} inline-flex items-center justify-center gap-2`}
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading && (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {confirmLabel}
            </BtnPrimary>
          </div>
        </div>
      </div>
    </Portal>
  );
}
