// api/moodle.js  —  Función serverless de Vercel (runtime Node)
// Milestone 1: login -> token -> materias + temas/módulos de la alumna.
// Resuelve CORS (la PWA llama aquí, esto llama a Moodle) y oculta la lógica del token.

const BASE = "https://aulacam.uearzobispomendez.edu.ve";

// Llama una función de Web Service de Moodle y devuelve JSON, lanzando si hay excepción.
async function callWS(token, wsfunction, params = {}) {
  const url = `${BASE}/webservice/rest/server.php`;
  const body = new URLSearchParams({
    wstoken: token,
    wsfunction,
    moodlewsrestformat: "json",
  });
  for (const [k, v] of Object.entries(params)) body.append(k, v);

  const res = await fetch(url, { method: "POST", body });
  const data = await res.json();
  if (data && data.exception) {
    throw new Error(`${wsfunction}: ${data.errorcode} — ${data.message}`);
  }
  return data;
}

// ───────── registro de usuario en Supabase (opcional, no bloquea el login) ─────────
function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
const ORD_G = { 1: "1er grado", 2: "2do grado", 3: "3er grado", 4: "4to grado", 5: "5to grado", 6: "6to grado" };
const ORD_A = { 1: "1er año", 2: "2do año", 3: "3er año", 4: "4to año", 5: "5to año" };
// Deriva grado ("4to grado" / "1er año") y token ("4G" / "1A") del shortname de un curso.
function gradoDeCursos(courses) {
  for (const c of courses || []) {
    const m = String(c.shortname || c.fullname || "").match(/([1-6])\s*([GA])\b/i);
    if (m) {
      const n = parseInt(m[1], 10), t = m[2].toUpperCase();
      return { grado: (t === "A" ? ORD_A : ORD_G)[n] || null, corto: `${n}${t}` };
    }
  }
  return { grado: null, corto: null };
}
// Crea/actualiza la fila del niño y suma un acceso (vía RPC). Nunca rompe el login.
async function registrarAcceso(userid, nombre, courses) {
  const cfg = supabaseCfg();
  if (!cfg || userid == null) return;
  const { grado, corto } = gradoDeCursos(courses);
  try {
    await fetch(`${cfg.url}/rest/v1/rpc/registrar_acceso`, {
      method: "POST",
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_id: userid, p_nombre: nombre || null, p_grado: grado, p_nombre_corto: corto }),
    });
  } catch (e) { /* el registro nunca debe romper el login */ }
}

// Intercambia usuario+clave por un token del servicio móvil.
async function getToken(username, password) {
  const body = new URLSearchParams({
    username,
    password,
    service: "moodle_mobile_app",
  });
  const res = await fetch(`${BASE}/login/token.php`, { method: "POST", body });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.token;
}

export default async function handler(req, res) {
  // CORS: por ahora abierto; cuando tengas el dominio de la PWA, cámbialo a ese origen.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  try {
    const { username, password, token: tokenPrevio } = req.body || {};

    // Si ya tienes token guardado lo reusas; si no, login con credenciales.
    const token = tokenPrevio || (await getToken(username, password));

    // 1) Quién es el usuario (de aquí sale el userid).
    const info = await callWS(token, "core_webservice_get_site_info");
    const userid = info.userid;

    // 2) Materias en las que está inscrita (esto define su grado).
    const courses = await callWS(token, "core_enrol_get_users_courses", { userid });

    // 3) Contenidos (temas + módulos) de cada materia.
    const materias = [];
    for (const c of courses) {
      const contenido = await callWS(token, "core_course_get_contents", { courseid: c.id });
      materias.push({
        id: c.id,
        nombre: c.fullname,
        nombreCorto: c.shortname,
        temas: contenido.map((s) => ({
          seccion: s.name,
          resumenHtml: s.summary || null,
          modulos: (s.modules || []).map((m) => ({
            id: m.id,
            nombre: m.name,
            tipo: m.modname,                 // assign, resource, page, label, url, forum...
            descripcionHtml: m.description || null,
            url: m.url || null,
            // pistas de "fecha" para detectar cambios más adelante:
            archivos: (m.contents || [])
              .filter((f) => f.type === "file")
              .map((f) => ({ nombre: f.filename, modificado: f.timemodified, url: f.fileurl })),
          })),
        })),
      });
    }

    // Registrar el acceso del niño en la BD (su "espacio"); no bloquea si falla.
    await registrarAcceso(userid, info.fullname, courses);

    return res.status(200).json({
      usuario: { id: userid, nombre: info.fullname, sitio: info.sitename },
      // devolvemos el token para que la PWA lo guarde y no repita login cada vez:
      token,
      materias,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
