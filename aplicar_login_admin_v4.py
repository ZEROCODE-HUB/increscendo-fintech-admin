#!/usr/bin/env python3
"""
aplicar_login_admin_v4.py — Increscendo, login del admin: anillos más acentuados

Requiere haber aplicado antes aplicar_login_admin_v3.py (usa su LoginRings).
Solo reemplaza la función LoginRings al final de src/routes/index.tsx:
  - Anillos exteriores de 6–10 % a 12–16 % de opacidad.
  - El anillo más externo de arriba con un leve tono cian de la marca.
  - Siguen solo en las esquinas (nada detrás del formulario).

Uso (desde la carpeta del admin):
    python aplicar_login_admin_v4.py --dry-run
    python aplicar_login_admin_v4.py
Respalda el archivo en _respaldo_AAAAMMDD_HHMM/ antes de escribir.
"""
import argparse, os, re, shutil, sys
from datetime import datetime

REL = os.path.join("src", "routes", "index.tsx")
MARK = "anillos-v4"

NEW_FN = """function LoginRings() {
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
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--root", default=".")
    a = ap.parse_args()
    root = os.path.abspath(a.root)
    path = os.path.join(root, REL)
    if not os.path.isfile(path):
        print("ERROR: no encuentro", REL, "en", root)
        return 1
    raw = open(path, "rb").read()
    crlf = b"\r\n" in raw
    s = raw.decode("utf-8").replace("\r\n", "\n")
    if MARK in s:
        print("Nada que hacer: los anillos ya están acentuados.")
        return 0
    m = re.search(r"\nfunction LoginRings\(\) \{.*?\n\}\n", s + "\n", re.S)
    if not m:
        print("ERROR: no encontré LoginRings. Corre primero aplicar_login_admin_v3.py.")
        return 2
    s = (s + "\n")[: m.start()] + "\n" + NEW_FN + (s + "\n")[m.end():]
    s = s.rstrip() + "\n"
    print("Archivo:", REL)
    print("  - anillos más definidos (12–16 %) y acento cian en el anillo externo")
    if a.dry_run:
        print("--dry-run: no se escribió nada.")
        return 0
    backup = os.path.join(root, "_respaldo_" + datetime.now().strftime("%Y%m%d_%H%M%S"), REL)
    os.makedirs(os.path.dirname(backup), exist_ok=True)
    shutil.copy2(path, backup)
    out = s.replace("\n", "\r\n") if crlf else s
    open(path, "wb").write(out.encode("utf-8"))
    print("Listo. Respaldo en", os.path.relpath(backup, root))
    print("Recarga la página con Ctrl+Shift+R (si no cambia, reinicia npm run dev).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
