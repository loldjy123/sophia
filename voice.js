// voice.js — Centralized narration controller (no overlap, awaitable)
// speech(text) resolves when audio ends OR immediately when stopSpeech() is called.

let currentAudio = null;
let currentUrl = null;
let currentResolve = null;
let playToken = 0;

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
  playToken++;
  const r = currentResolve;
  cleanup();
  try { r && r(); } catch {}
}

async function fetchTTSMp3(text) {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`TTS error: ${res.status} ${res.statusText} ${msg}`);
  }

  return await res.arrayBuffer(); // mp3 bytes
}

export async function speech(text) {
  const t = String(text ?? "").trim();
  if (!t) return;

  stopSpeech(); // no overlap
  const myToken = ++playToken;

  try {
    const mp3ArrayBuffer = await fetchTTSMp3(t);

    if (myToken !== playToken) return; // cancelled mid-download

    const blob = new Blob([mp3ArrayBuffer], { type: "audio/mpeg" });
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
    console.error("TTS failed:", err);
    if (myToken === playToken) {
      const r = currentResolve;
      cleanup();
      try { r && r(); } catch {}
    }
  }
}
