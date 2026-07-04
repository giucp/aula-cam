// api/admin-check.js — Función serverless de Vercel (runtime Node)
// Valida la clave de administrador del "cuarto de pruebas" contra ADMIN_KEY (env de
// Vercel). La comparación es SOLO server-side; la clave nunca viaja en el código ni al
// cliente. POST { clave } → 200 {ok:true} si coincide, 401 si no.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://aula-cam.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const clave = req.body && req.body.clave;
  if (!process.env.ADMIN_KEY || clave !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false });
  }
  return res.status(200).json({ ok: true });
}
