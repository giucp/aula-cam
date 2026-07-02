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

// ───────── control de acceso (código de invitación) ─────────
// El candado está APAGADO mientras no exista la env ACCESO_CODIGO. Al ponerla, solo
// entran los usuarios ya autorizados (usuarios.autorizado=true) o quien traiga el
// código correcto en su primer login (ahí queda autorizado para siempre).
// Fail-open: si Supabase no responde, no bloqueamos (mejor no dejar afuera a un niño
// por un hipo de infraestructura; siguen necesitando clave real del aula).
async function estaAutorizado(userid) {
  const cfg = supabaseCfg();
  if (!cfg || userid == null) return true;
  try {
    const r = await fetch(`${cfg.url}/rest/v1/usuarios?id=eq.${userid}&select=autorizado`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    });
    if (!r.ok) return true;
    const rows = await r.json();
    return !!(Array.isArray(rows) && rows[0] && rows[0].autorizado);
  } catch (e) { return true; }
}
// Marca al usuario como autorizado (upsert: crea la fila si no existe).
async function autorizar(userid, nombre, courses) {
  const cfg = supabaseCfg();
  if (!cfg || userid == null) return;
  const { grado, corto } = gradoDeCursos(courses);
  try {
    await fetch(`${cfg.url}/rest/v1/usuarios`, {
      method: "POST",
      headers: {
        apikey: cfg.key, Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json", Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ id: userid, nombre: nombre || null, grado, nombre_corto: corto, autorizado: true }),
    });
  } catch (e) { /* no romper el login */ }
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
  res.setHeader("Access-Control-Allow-Origin", "https://aula-cam.vercel.app");
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

    // 2.5) CONTROL DE ACCESO: si el candado está activo (existe ACCESO_CODIGO), solo
    //      pasan los ya autorizados o quien traiga el código correcto. Se chequea
    //      ANTES de bajar el contenido pesado.
    const CODIGO = process.env.ACCESO_CODIGO;
    if (CODIGO) {
      let ok = await estaAutorizado(userid);
      if (!ok) {
        const codigo = String((req.body && req.body.codigo) || "").trim();
        if (codigo && codigo === CODIGO) {
          await autorizar(userid, info.fullname, courses);
          ok = true;
        }
      }
      if (!ok) {
        // registrar al niño como pendiente (para que el admin lo vea) y pedir el código
        await registrarAcceso(userid, info.fullname, courses);
        return res.status(403).json({
          error: "Necesitas un código de acceso para tu primera vez. Pídeselo al administrador.",
          code: "sin_acceso",
        });
      }
    }

    // 3) Contenidos (temas + módulos) de cada materia — EN PARALELO (mucho más
    //    rápido que curso por curso contra un servidor escolar lento).
    const contenidos = await Promise.all(
      courses.map((c) => callWS(token, "core_course_get_contents", { courseid: c.id }))
    );
    const materias = courses.map((c, i) => ({
      id: c.id,
      nombre: c.fullname,
      nombreCorto: c.shortname,
      temas: (contenidos[i] || []).map((s) => ({
        seccion: s.name,
        resumenHtml: s.summary || null,
        modulos: (s.modules || []).map((m) => ({
          id: m.id,
          nombre: m.name,
          tipo: m.modname,                 // assign, resource, page, label, url, forum...
          descripcionHtml: m.description || null,
          url: m.url || null,
          // pistas de "fecha" para detectar cambios (firma de contenido en la caché):
          archivos: (m.contents || [])
            .filter((f) => f.type === "file")
            .map((f) => ({ nombre: f.filename, modificado: f.timemodified, url: f.fileurl })),
        })),
      })),
    }));

    // Registrar el acceso del niño en la BD (su "espacio"); no bloquea si falla.
    await registrarAcceso(userid, info.fullname, courses);

    return res.status(200).json({
      usuario: { id: userid, nombre: info.fullname, sitio: info.sitename },
      // devolvemos el token para que la PWA lo guarde y no repita login cada vez:
      token,
      materias,
    });
  } catch (e) {
    // Token guardado vencido/ inválido → 401 claro para que el front vuelva al login.
    if (/invalidtoken|expired|accessexception/i.test(String(e.message))) {
      return res.status(401).json({ error: "Tu sesión venció. Entra de nuevo.", code: 401 });
    }
    return res.status(500).json({ error: String(e.message || e) });
  }
}
