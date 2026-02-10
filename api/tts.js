// pages/api/tts.js
import { ElevenLabsClient } from "elevenlabs"; // npm i elevenlabs (official package)

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
    return res.status(500).json({ error: e.message || String(e) });
  }
}
