import { Portal } from "./portal";
import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { BtnPrimary, BtnOutline } from "./portal-shell";

export type WizardStep = { label: string; content: ReactNode };

export function WizardModal({
  open,
  onClose,
  title,
  steps,
  onFinish,
  finishLabel = "Finalizar",
  finishDisabled,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  steps: WizardStep[];
  onFinish: () => void;
  finishLabel?: string;
  finishDisabled?: boolean;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open) return null;

  const isLast = step === steps.length - 1;

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-card rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl">
          <div className="sticky top-0 bg-card border-b px-6 py-4 z-10">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display font-semibold text-lg">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-muted rounded-md"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
              {steps.map((s, i) => (
                <div
                  key={i}
                  className={`text-[11px] font-semibold ${
                    i === step
                      ? "text-primary"
                      : i < step
                        ? "text-muted-foreground"
                        : "text-muted-foreground/50"
                  }`}
                >
                  {i + 1}. {s.label}
                </div>
              ))}
            </div>
          </div>

          <div className="p-6">{steps[step].content}</div>

          <div className="sticky bottom-0 bg-card border-t px-6 py-4 flex justify-between gap-2">
            <BtnOutline
              type="button"
              onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}
            >
              {step === 0 ? "Cancelar" : "Atrás"}
            </BtnOutline>
            {isLast ? (
              <BtnPrimary
                type="button"
                onClick={onFinish}
                disabled={finishDisabled}
              >
                {finishLabel}
              </BtnPrimary>
            ) : (
              <BtnPrimary type="button" onClick={() => setStep((s) => s + 1)}>
                Siguiente
              </BtnPrimary>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
