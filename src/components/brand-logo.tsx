import logoFull from "@/assets/logo-full.webp";
import logoLight from "@/assets/logo-light.webp";

/**
 * Logo de Increscendo Fintech.
 * - variant "dark": versión a color para fondos claros (header).
 * - variant "light": versión clara para fondos oscuros (login, menú lateral).
 */
export function BrandLogo({
  className = "",
  variant = "dark",
  size = 32,
}: {
  className?: string;
  variant?: "dark" | "light";
  size?: number;
}) {
  return (
    <div className={`inline-flex items-center ${className}`}>
      <img
        src={variant === "light" ? logoLight : logoFull}
        alt="Increscendo Fintech"
        style={{ height: size, width: "auto", display: "block" }}
      />
    </div>
  );
}
