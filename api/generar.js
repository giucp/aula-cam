// api/generar.js  —  Función serverless de Vercel (runtime Node)
// Genera ejercicios de práctica NUEVOS con IA (Gemini Flash) a partir de un tema.
// La clave NO va aquí: va en Vercel como variable de entorno GEMINI_API_KEY.

// Si al probar da error de "modelo no encontrado", cambia esta línea por el
// modelo exacto que uses en el lab-bot y vuelves a desplegar.
const MODEL = "gemini-2.5-flash";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  try {
    const { materia, tema, grado = "4to grado", cantidad = 5 } = req.body || {};
    if (!tema) return res.status(400).json({ error: "Falta el campo 'tema'" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Falta GEMINI_API_KEY en Vercel" });

    const prompt = `Eres un docente de ${grado} en Venezuela.
Tema: "${tema}" (materia: ${materia || "Lógica Matemática"}).
Genera ${cantidad} ejercicios de práctica NUEVOS de ese mismo tipo y tema, distintos entre sí, apropiados para ${grado}, en español de Venezuela.
Que sean claros y resolubles, con dificultad acorde a la edad.
Responde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown, con esta forma exacta:
{"ejercicios":[{"enunciado":"...","pista":"...","solucion":"..."}]}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          responseMimeType: "application/json", // fuerza a Gemini a devolver JSON limpio
        },
      }),
    });

    const data = await r.json();
    if (data.error) throw new Error(data.error.message);

    const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const limpio = texto.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(limpio);

    return res.status(200).json({ tema, materia: materia || null, ...parsed });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
