#!/usr/bin/env python3
"""
aplicar_login_admin_v2.py — Increscendo, login del panel de administración

Versión "quirúrgica": NO reemplaza el archivo completo. Solo cambia el fondo
del login y conserva cualquier otro cambio que tengas en src/routes/index.tsx.

  1. Reemplaza el bloque del fondo (foto + capa de contraste) por:
     gradiente oscuro navy → verde azulado, foto como textura tenue (3.5 %)
     y círculos (brillos + anillos con borde fino).
  2. Agrega el componente LoginRings al final del archivo.
  3. Si encuentra el fondo semitransparente de la tarjeta, lo pasa a blanco nítido.

Uso (desde la carpeta del proyecto admin, donde está package.json):
    python aplicar_login_admin_v2.py --dry-run
    python aplicar_login_admin_v2.py
Respalda el archivo en _respaldo_AAAAMMDD_HHMM/ antes de escribir.
"""
import argparse, os, re, shutil, sys
from datetime import datetime

REL = os.path.join("src", "routes", "index.tsx")

NEW_BG = """      {/* Fondo: gradiente oscuro (mismo que el login del cliente) + foto muy tenue */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "linear-gradient(150deg, #070f1c 0%, #0d1a2e 38%, #13213a 68%, #123a40 100%)" }}
      />
      <div aria-hidden className="absolute inset-0 overflow-hidden" style={{ opacity: 0.035 }}>
        <img src={loginBackground} alt="" className="absolute inset-0 h-full w-full object-cover animate-kenburns" />
      </div>

      {/* Círculos: brillos suaves + anillos con borde fino */}
      <LoginRings />

"""

RINGS = """

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
      <div className="absolute rounded-full" style={{ width: 520, height: 520, right: -160, top: -170, background: "rgba(31,165,196,0.16)", filter: "blur(110px)" }} />
      <div className="absolute rounded-full" style={{ width: 440, height: 440, left: -140, bottom: -150, background: "rgba(35,149,126,0.18)", filter: "blur(110px)" }} />
      {ring(640, { right: -260, top: -260 }, 0.09)}
      {ring(440, { right: -160, top: -160 }, 0.07)}
      {ring(250, { right: -70, top: -70 }, 0.05, 0.015)}
      {ring(520, { left: -260, bottom: -260 }, 0.07)}
      {ring(320, { left: -150, bottom: -150 }, 0.05)}
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
    if not os.path.isfile(path) or not os.path.isfile(os.path.join(root, "src", "routes", "admin.tsx")):
        print("ERROR: no encuentro src/routes/index.tsx y src/routes/admin.tsx en", root)
        return 1

    raw = open(path, "rb").read()
    crlf = b"\r\n" in raw
    s = raw.decode("utf-8").replace("\r\n", "\n")

    if "function LoginRings" in s:
        print("Nada que hacer: el login ya tiene los círculos.")
        return 0

    done = []

    # 1) Bloque de fondo: desde el primer elemento de fondo hasta el contenedor del formulario.
    start_markers = ["{/* Animated background image */}", "{/* Contrast overlay */}"]
    start = min((s.find(m) for m in start_markers if m in s), default=-1)
    end = s.find('<div className="w-full max-w-[400px] relative">')
    if start == -1 or end == -1 or end < start:
        print("ERROR: no encontré el bloque del fondo del login (comentario 'Animated background image'")
        print("y el contenedor 'w-full max-w-[400px] relative'). Pásame tu src/routes/index.tsx y lo integro a mano.")
        return 2
    line_start = s.rfind("\n", 0, start) + 1
    line_end = s.rfind("\n", 0, end) + 1
    s = s[:line_start] + NEW_BG + s[line_end:]
    done.append("fondo: gradiente oscuro + círculos")

    if "loginBackground" not in s.split("export const Route")[0]:
        print("AVISO: no veo el import de loginBackground; la foto tenue podría no cargar.")

    # 2) Componente al final + import de tipos de React si falta.
    s = s.rstrip() + RINGS
    if not re.search(r"^import (type )?React\b", s, re.M):
        s = 'import type React from "react";\n' + s
    done.append("componente LoginRings")

    # 3) Tarjeta: vidrio semitransparente -> blanco nítido (si existe tal cual).
    old_card = re.compile(r'background:\s*"rgba\(255,\s*255,\s*255,\s*0\.55\)",')
    if old_card.search(s):
        s = old_card.sub('background: "rgba(255, 255, 255, 0.97)",\n            boxShadow: "0 30px 80px rgba(0,0,0,0.5)",', s, count=1)
        done.append("tarjeta del formulario en blanco nítido")

    print("Archivo:", REL)
    for d in done:
        print("  -", d)
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
