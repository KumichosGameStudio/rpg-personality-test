export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { model, prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing OPENAI_API_KEY" });

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-4.1-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a strict JSON-only scorer." },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: "OpenAI error", details: data });
    }

    const content = data?.choices?.[0]?.message?.content ?? "";
    return res.status(200).json({ content });
  } catch (e) {
    return res.status(500).json({ error: "Server exception", details: String(e) });
  }
}
