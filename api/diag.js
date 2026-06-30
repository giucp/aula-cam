// api/diag.js — diagnóstico TEMPORAL del caché Supabase. No expone claves.
// Borrar después de diagnosticar.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_KEY || "";

  const out = {
    tieneUrl: !!url,
    urlHost: url ? url.replace(/^https?:\/\//, "").split("/")[0] : null,
    urlTraeRestV1: /\/rest\/v1/.test(url), // error común: dejar /rest/v1 en la URL
    tieneKey: !!key,
    keyRol: null,                          // anon | service_role (sacado del JWT, sin la firma)
    selectStatus: null,
    selectBody: null,
  };

  // rol de la key: el JWT trae el claim "role" en el payload (no es secreto)
  try {
    const payload = JSON.parse(Buffer.from((key.split(".")[1] || ""), "base64").toString("utf8"));
    out.keyRol = payload.role || null;
  } catch (e) {}

  // probar un SELECT contra la tabla
  if (url && key) {
    try {
      const base = url.replace(/\/+$/, "");
      const r = await fetch(`${base}/rest/v1/cache_generaciones?select=clave&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      out.selectStatus = r.status;
      out.selectBody = (await r.text()).slice(0, 200);
    } catch (e) {
      out.selectBody = "fetch error: " + String(e.message || e);
    }
  }

  res.status(200).json(out);
}
