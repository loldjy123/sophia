// voice.js — Centralized narration controller (no overlap, awaitable)
// speech(text) returns a Promise that resolves ONLY when the audio ends,
// OR immediately when stopSpeech() is called (so play loops can cancel fast).

import { ElevenLabsClient } from 'https://esm.sh/@elevenlabs/elevenlabs-js';

// const VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
const VOICE_ID = 'hpp4J3VqNfWAUOO0d1Us';
const MODEL_ID = 'eleven_multilingual_v2';

// NOTE: For production, DO NOT ship your ElevenLabs API key in the browser.
// Put TTS behind your own server endpoint and call that instead.
//const ELEVEN_API_KEY = 'sk_4ef53dc4a7e9237f213e65a7633a6c30998024d3e60d4a47';
const ELEVEN_API_KEY = 'sk_cc914ab5eff3ce94b968df629c2d0bfe3813f6ebf1e1de0f';

let elevenlabs = null;

let currentAudio = null;
let currentUrl = null;

// Used to resolve the Promise from the currently-playing speech()
let currentResolve = null;

// Used to ignore stale async completions
let playToken = 0;

function getClient() {
  if (!elevenlabs) {
    elevenlabs = new ElevenLabsClient({ apiKey: ELEVEN_API_KEY });
  }
  return elevenlabs;
}

function cleanup() {
  try {
    if (currentAudio) {
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.pause();
      currentAudio.src = "";
    }
  } catch {}

  try {
    if (currentUrl) URL.revokeObjectURL(currentUrl);
  } catch {}

  currentAudio = null;
  currentUrl = null;
  currentResolve = null;
}

export function isSpeaking() {
  return !!currentAudio && !currentAudio.paused;
}

export function stopSpeech() {
  // Cancel current playback and resolve whoever was awaiting speech()
  playToken++;

  const r = currentResolve;
  cleanup();

  try { r && r(); } catch {}
}

export async function speech(text) {
  const t = String(text ?? "").trim();
  if (!t) return;

  // Stop any previous audio (no overlap)
  stopSpeech();

  const myToken = ++playToken;

  try {
    const client = getClient();

    const audioStream = await client.textToSpeech.convert(
      VOICE_ID,
      { text: t, modelId: MODEL_ID, outputFormat: "mp3_44100_128" }
    );

    // Collect stream into one MP3 blob
    const chunks = [];
    for await (const chunk of audioStream) chunks.push(chunk);

    // If we got cancelled while downloading, just exit
    if (myToken !== playToken) return;

    const blob = new Blob(chunks, { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      if (myToken !== playToken) {
        try { URL.revokeObjectURL(url); } catch {}
        return resolve();
      }

      const audio = new Audio(url);

      currentAudio = audio;
      currentUrl = url;
      currentResolve = resolve;

      const finish = () => {
        // Ignore stale callbacks
        if (myToken !== playToken) return;
        const r = currentResolve;
        cleanup();
        try { r && r(); } catch {}
      };

      audio.onended = finish;
      audio.onerror = finish;

      audio.play().catch(finish);
    });

  } catch (err) {
    // Fail silently (but log for debugging)
    console.error("TTS failed:", err);
    // If still current, cleanup and resolve
    if (myToken === playToken) {
      const r = currentResolve;
      cleanup();
      try { r && r(); } catch {}
    }
  }
}