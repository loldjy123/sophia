// pages/api/tts.js
import { ElevenLabsClient } from "elevenlabs"; // npm i elevenlabs (official package)



const VOICE_ID = "hpp4J3VqNfWAUOO0d1Us";
const MODEL_ID = "eleven_multilingual_v2";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const apiKey = process.env.EL_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing EL_KEY" });

    const { text } = req.body || {};
    const t = String(text ?? "").trim();
    if (!t) return res.status(400).json({ error: "Missing text" });

    const client = new ElevenLabsClient({ apiKey });

    const audioStream = await client.textToSpeech.convert(VOICE_ID, {
      text: t,
      modelId: MODEL_ID,
      outputFormat: "mp3_44100_128",
    });

    // Collect stream into a single Buffer
    const chunks = [];
    for await (const chunk of audioStream) chunks.push(Buffer.from(chunk));
    const audioBuffer = Buffer.concat(chunks);

    // Send raw mp3 bytes
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(audioBuffer);
    } catch (e) {
    const status = e?.statusCode || e?.status || 500;

    // Try to extract useful details from ElevenLabs SDK errors
    let details =
      e?.body?.detail ||
      e?.body?.message ||
      e?.response?.data ||
      e?.message ||
      String(e);

    // Make sure it's a string
    if (typeof details !== "string") {
      try { details = JSON.stringify(details); } catch { details = String(details); }
    }

    // IMPORTANT: return plain text so your voice.js sees it in res.text()
    res.setHeader("Content-Type", "text/plain");
    return res.status(status).send(details);
  }

}
