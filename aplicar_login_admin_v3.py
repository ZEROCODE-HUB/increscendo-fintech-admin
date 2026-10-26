#!/usr/bin/env python3
"""
aplicar_login_admin_v3.py — Increscendo, login del admin (hecho para TU versión)

Tu login ya tiene su fondo propio (mesh de orbes + grano + viñeta). Este
script NO lo borra: le agrega encima lo del login del cliente.
  1. Base de gradiente oscuro (navy profundo → verde azulado) debajo de tus orbes.
  2. Círculos definidos: anillos con borde fino arriba a la derecha y abajo a la
     izquierda + brillos suaves, por encima de la viñeta para que se vean.
  3. Componente LoginRings al final del archivo.
La tarjeta de vidrio, el formulario y los textos quedan exactamente igual.

Uso (desde la carpeta del admin):
    python aplicar_login_admin_v3.py --dry-run
    python aplicar_login_admin_v3.py
Respalda el archivo en _respaldo_AAAAMMDD_HHMM/ antes de escribir.
"""
import argparse, os, re, shutil, sys
from datetime import datetime

REL = os.path.join("src", "routes", "index.tsx")

BASE = """
        {/* Base: gradiente oscuro del login del cliente */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(150deg, #070f1c 0%, #0d1a2e 38%, #13213a 68%, #123a40 100%)" }}
        />"""

RINGS_TAG = """
        {/* Círculos definidos (por encima de la viñeta) */}
        <LoginRings />"""

RINGS_FN = """

function LoginRings() {
  const ring = (size: number, pos: React.CSSProperties, alpha: number, fill = 0) => (
    <div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        border: `1px solid rgba(255,255,255,${alpha})`,
        background: fill ? `rgba(255,255,255,${fill})` : undefined,
        ...pos,
      }}
    />
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute rounded-full" style={{ width: 520, height: 520, right: -160, top: -170, background: "rgba(31,165,196,0.14)", filter: "blur(110px)" }} />
      <div className="absolute rounded-full" style={{ width: 440, height: 440, left: -140, bottom: -150, background: "rgba(35,149,126,0.16)", filter: "blur(110px)" }} />
      {ring(640, { right: -260, top: -260 }, 0.1)}
      {ring(440, { right: -160, top: -160 }, 0.08)}
      {ring(250, { right: -70, top: -70 }, 0.06, 0.015)}
      {ring(520, { left: -260, bottom: -260 }, 0.08)}
      {ring(320, { left: -150, bottom: -150 }, 0.06)}
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

    if "function LoginRings" in s:
        print("Nada que hacer: el login ya tiene los círculos.")
        return 0

    # 1) Base de gradiente: primer hijo del contenedor login-surface.
    m1 = re.search(r'<div aria-hidden className="login-surface[^"]*"[^>]*>', s)
    if not m1:
        print("ERROR: no encontré el contenedor 'login-surface'. Pásame tu src/routes/index.tsx.")
        return 2
    s = s[: m1.end()] + BASE + s[m1.end():]

    # 2) Anillos: último hijo de login-surface (después de la viñeta).
    #    Se busca el cierre del contenedor justo antes del bloque del formulario.
    m2 = re.search(r'\n(\s*)</div>\s*\n\s*<div className="w-full max-w-\[400px\] relative">', s)
    if not m2:
        print("ERROR: no encontré el cierre del fondo antes del formulario. Pásame tu src/routes/index.tsx.")
        return 2
    s = s[: m2.start()] + RINGS_TAG + s[m2.start():]

    # 3) Componente al final.
    s = s.rstrip() + RINGS_FN

    print("Archivo:", REL)
    print("  - base de gradiente oscuro bajo tus orbes")
    print("  - anillos definidos + brillos (LoginRings)")
    print("  - tarjeta, formulario y textos sin cambios")
    if a.dry_run:
        print("--dry-run: no se escribió nada.")
        return 0

    backup = os.path.join(root, "_respaldo_" + datetime.now().strftime("%Y%m%d_%H%M"), REL)
    os.makedirs(os.path.dirname(backup), exist_ok=True)
    shutil.copy2(path, backup)
    out = s.replace("\n", "\r\n") if crlf else s
    open(path, "wb").write(out.encode("utf-8"))
    print("Listo. Respaldo en", os.path.relpath(backup, root))
    print("Ahora: Ctrl+C en el servidor, npm run dev y recarga con Ctrl+Shift+R.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
