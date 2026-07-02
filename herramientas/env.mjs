// herramientas/env.mjs
// Carga .env.local (KEY=valor por línea) al process.env, sin dependencias.
// Lo usan los scripts LOCALES de curaduría (moodle-leer, cargar-curado). NO se
// despliega a Vercel (allá las envs vienen del panel). Nunca pisa una env ya puesta.
import fs from "node:fs";
import path from "node:path";

export function cargarEnvLocal() {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const linea of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const s = linea.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i < 0) continue;
    const k = s.slice(0, i).trim();
    let v = s.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (k && !(k in process.env)) process.env[k] = v;
  }
}
