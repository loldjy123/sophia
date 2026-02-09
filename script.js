
import { askGemini, askSophiaJudge, handleInterruption, courseGenerator, fixAgent } from "./gemini.js";
import { speech, stopSpeech } from "./voice.js";
import { SophiaVisualizer } from "./visualizer.js";

SophiaVisualizer.init("sophia-orb-container");

// -----------------------------
// DOM refs
// -----------------------------
const feed = document.getElementById("feed");

const playPauseBtn = document.getElementById("playPauseBtn");
const pauseIcon = document.getElementById("pauseIcon");
const playIcon = document.getElementById("playIcon");

const backBtn = document.getElementById("backBtn");
const forwardBtn = document.getElementById("forwardBtn");

const handBtn = document.getElementById("handBtn");
const screenEl = document.getElementById("screen");

const fsBtn = document.getElementById("fsBtn");
const enterFS = document.getElementById("enterFS");
const exitFS = document.getElementById("exitFS");

const ask = document.getElementById("ask");
const actionBtn = document.getElementById("actionBtn");

const sendIcon = document.getElementById("sendIcon");
const micIcon = document.getElementById("micIcon");
const stopIcon = document.getElementById("stopIcon");

const recordingPanel = document.getElementById("recordingPanel");
const recordingTimeEl = document.getElementById("recordingTime");

let isCourseMode = false;
const plusBtn = document.getElementById('plusMenuBtn');
const createCourseBtn = document.getElementById('createCourseBtn');
const askInput = document.getElementById('ask');
const chatList = document.querySelector('.chat-list');


const layoutEl = document.querySelector(".layout");
const leftHeaderToggle = document.getElementById("leftHeaderToggle");
const miniExpandLeft = document.getElementById("miniExpandLeft");
const rightHeaderToggle = document.getElementById("rightHeaderToggle");

// Overlay
const overlayEl = document.getElementById("sophia-overlay");

// Question popup (small menu above the ? button)
const questionPopupEl = document.getElementById("questionPopup");
const questionTextEl = document.getElementById("questionText");
const questionBtn = document.getElementById("questionBtn");


// -----------------------------
// Global state
// -----------------------------
let isRecording = false;
let recordingSeconds = 0;
let recordingTimer = null;

let lessonMode = "none"; // "sandbox" | "steps"
let userWantsAudio = false; // true only while playing
let playLoopToken = 0; // cancels prior play loops

// Steps mode
let stepsLines = [];
let stepsExplanations = [];
let stepsQuestions = []; // ✅ was missing in your file; caused runtime errors
let stepsIdx = 0;
let stepsPaused = true;

// Sandbox mode
let sandboxFrame = null;
let sandboxExplanations = [];
let sandboxQuestions = [];
let sandboxState = { ready: false, step: 0, totalSteps: 0 };
let sandboxPaused = true;

// SpeechRecognition (module-scope, no shadowing)
let recognition = null;

// -----------------------------
// Utilities
// -----------------------------
function setPlayPauseUI(isPlaying) {
  if (!pauseIcon || !playIcon) return;
  pauseIcon.style.display = isPlaying ? "block" : "none";
  playIcon.style.display = isPlaying ? "none" : "block";

  // Disable text input while playing to focus the user
  if (ask) {
    ask.disabled = isPlaying;
    ask.placeholder = isPlaying 
      ? "Lesson in progress... Raise hand to ask!" 
      : "Ask Sophia anything...";
  }
}

function clearFeed() {
  if (feed) feed.innerHTML = "";
}

function appendTextLine(text) {
  const div = document.createElement("div");
  div.style.padding = "10px";
  div.style.borderBottom = "1px solid #eee";
  div.textContent = String(text ?? "");
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

function hardStopAudio() {
  stopSpeech();
}

function clampStep(i, max) {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(i, max - 1));
}

// If you have a progress function elsewhere, it will be used.
// If not, this prevents "updateProgress is not defined" crashes.
function safeUpdateProgress() {
  try {
    if (typeof updateProgress === "function") updateProgress();
  } catch (e) {}
}

// -----------------------------
// Robust JSON parsing (Gemini)
// -----------------------------
function stripBadControlChars(s) {
  return String(s).replace(/[\u0000-\u001F\u007F]/g, "");
}

function extractJsonBlock(text) {
  const t = String(text ?? "");
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  return t.slice(first, last + 1);
}

function safeJsonParse(text) {
  const raw = String(text ?? "");
  try {
    return JSON.parse(raw);
  } catch {}
  const block = extractJsonBlock(raw);
  if (!block) throw new Error("No JSON object found in model output.");
  try {
    return JSON.parse(block);
  } catch {}
  return JSON.parse(stripBadControlChars(block));
}

// -----------------------------
// Sandbox bridge injection
// -----------------------------
function buildBridgeScript() {
  return `
<script>
(() => {
  const post = (type, payload) => {
    try { window.parent.postMessage({ type, payload }, "*"); } catch(e) {}
  };
  function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

  async function ensureReady() {
    const lc = window.lessonControl;
    if (!lc || typeof lc.goToStep !== "function") return false;

    const totalSteps = Number(lc.totalSteps ?? 0) || 0;
    let step = 0;

    if (typeof lc.getState === "function") {
      const s = lc.getState();
      if (s && typeof s.step === "number") step = s.step;
    } else {
      try { await lc.goToStep(0, true); step = 0; } catch(e) {}
    }

    post("READY", { totalSteps, step });
    post("STATE", { totalSteps, step });
    return true;
  }

  async function goTo(step, instant) {
    const lc = window.lessonControl;
    if (!lc || typeof lc.goToStep !== "function") return;

    const totalSteps = Number(lc.totalSteps ?? 0) || 0;
    const hi = Math.max(0, (totalSteps || 1) - 1);
    const target = clamp(Number(step) || 0, 0, hi);

    await lc.goToStep(target, !!instant);

    let finalStep = target;
    let finalTotal = totalSteps;

    if (typeof lc.getState === "function") {
      const s = lc.getState();
      if (s && typeof s.step === "number") finalStep = s.step;
      if (s && typeof s.totalSteps === "number") finalTotal = s.totalSteps;
    }

    post("STATE", { totalSteps: finalTotal, step: finalStep });
  }

  window.addEventListener("message", async (event) => {
    const msg = event.data || {};
    const type = msg.type;
    const payload = msg.payload || {};

    if (!(await ensureReady())) return;

    try {
      if (type === "SEEK") await goTo(payload.step, payload.instant);
      if (type === "NEXT") await goTo((payload.step ?? 0) + 1, false);
      if (type === "PREV") await goTo((payload.step ?? 0) - 1, true);
      if (type === "RESET") await goTo(0, true);
      if (type === "GET_STATE") await ensureReady();
    } catch (e) {
      post("STATE", { error: String(e?.message || e) });
    }
  });

  window.addEventListener("load", () => { ensureReady(); });
  setTimeout(() => ensureReady(), 250);
  setTimeout(() => ensureReady(), 800);
})();
</script>
`.trim();
}

function htmlLooksLikeFullDoc(html) {
  const h = String(html ?? "").toLowerCase();
  return h.includes("<!doctype") || h.includes("<html");
}

function wrapHtmlFragment(fragment) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    html, body { margin:0; padding:0; height:100%; width:100%; overflow:hidden; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  </style>
</head>
<body>${String(fragment ?? "")}</body>
</html>`;
}

function injectBridgeIntoHtml(html) {
  const bridge = buildBridgeScript();
  const lower = String(html).toLowerCase();
  const idx = lower.lastIndexOf("</body>");
  if (idx !== -1) return html.slice(0, idx) + "\n" + bridge + "\n" + html.slice(idx);
  return html + "\n" + bridge;
}

function sandboxPost(type, payload = {}) {
  if (!sandboxFrame?.contentWindow) return;
  sandboxFrame.contentWindow.postMessage({ type, payload }, "*");
}

// Parent listener for sandbox READY/STATE
function attachSandboxListenerOnce() {
  if (attachSandboxListenerOnce._attached) return;
  attachSandboxListenerOnce._attached = true;

  window.addEventListener("message", (event) => {
    if (!sandboxFrame || event.source !== sandboxFrame.contentWindow) return;
    const msg = event.data || {};
    const type = msg.type;
    const payload = msg.payload || {};

    if (type === "READY") {
      sandboxState.ready = true;
      sandboxState.totalSteps = Number(payload.totalSteps ?? 0) || sandboxExplanations.length || 0;
      sandboxState.step = Number(payload.step ?? 0) || 0;
      return;
    }

    if (type === "STATE") {
      if (typeof payload.totalSteps === "number") sandboxState.totalSteps = payload.totalSteps;
      if (typeof payload.step === "number") sandboxState.step = payload.step;
    }
  });
}

function waitForSandboxStep(targetStep, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (!sandboxFrame) return resolve(false);
      if (sandboxState.step === targetStep) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(tick, 25);
    };
    tick();
  });
}

// -----------------------------
// Load lessons
// -----------------------------
async function loadSandboxLesson(lesson) {
  lessonMode = "sandbox";
  sandboxPaused = true;
  userWantsAudio = false;
  playLoopToken++;
  hardStopAudio();

  sandboxExplanations = Array.isArray(lesson?.explanations) ? lesson.explanations.map((x) => String(x ?? "")) : [];
  sandboxQuestions = Array.isArray(lesson?.questions) ? lesson.questions : [];
  sandboxState = { ready: false, step: 0, totalSteps: sandboxExplanations.length || 0 };

  clearFeed();
  if (sandboxFrame) {
    try {
      sandboxFrame.remove();
    } catch {}
    sandboxFrame = null;
  }

  sandboxFrame = document.createElement("iframe");
  sandboxFrame.setAttribute("sandbox", "allow-scripts");
  sandboxFrame.style.width = "100%";
  sandboxFrame.className = "sandbox-frame";
  sandboxFrame.style.border = "1px solid #eee";
  sandboxFrame.style.borderRadius = "12px";
  sandboxFrame.style.background = "#fff";

  let html = String(lesson?.html ?? "");
  if (!htmlLooksLikeFullDoc(html)) html = wrapHtmlFragment(html);
  html = injectBridgeIntoHtml(html);

  sandboxFrame.srcdoc = html;
  feed.appendChild(sandboxFrame);

  attachSandboxListenerOnce();
  setPlayPauseUI(false);
}

function loadStepsLesson(lesson) {
  lessonMode = "steps";
  stepsPaused = true;
  userWantsAudio = false;
  playLoopToken++;
  hardStopAudio();

  stepsLines = Array.isArray(lesson?.steps) ? lesson.steps.map((x) => String(x ?? "")) : [];
  stepsExplanations = Array.isArray(lesson?.explanations) ? lesson.explanations.map((x) => String(x ?? "")) : [];
  stepsQuestions = Array.isArray(lesson?.questions) ? lesson.questions : [];

  stepsIdx = 0;
  clearFeed();
  if (stepsLines.length) appendTextLine(stepsLines[0]);
  setPlayPauseUI(false);
}


function showQuestionPopup(text) {
  if (!questionPopupEl || !questionTextEl) return false;
  questionTextEl.textContent = String(text ?? "");
  questionPopupEl.classList.remove("question-popup-hidden");
  return true;
}

function hideQuestionPopup() {
  if (!questionPopupEl) return;
  questionPopupEl.classList.add("question-popup-hidden");
}

// Popup-question state (so we can reuse the same input box)
let pendingPopupAnswer = null; 
// { resolve, tokenAtStart, restore: { disabled, placeholder }, resumeSandbox: boolean }



// -----------------------------
// Step jumping (manual)
// -----------------------------
let stepQueue = Promise.resolve();
function enqueue(fn) {
  stepQueue = stepQueue.then(fn).catch(() => {});
  return stepQueue;
}

function goToStep(newIndex, { speakThisStep = false, instant = true } = {}) {
  return enqueue(async () => {
    hardStopAudio();

    if (lessonMode === "sandbox") {
      if (!sandboxState.ready) return;
      const max = sandboxState.totalSteps || sandboxExplanations.length || 0;
      const idx = clampStep(newIndex, max);

      sandboxPost("SEEK", { step: idx, instant: !!instant });
      await waitForSandboxStep(idx, 2500);

      if (speakThisStep && userWantsAudio) {
        const text = sandboxExplanations[idx] || "";
        if (text) await speech(text);
      }
      return;
    }

    if (lessonMode === "steps") {
      const max = stepsLines.length;
      const idx = clampStep(newIndex, max);
      stepsIdx = idx;

      clearFeed();
      for (let i = 0; i <= idx; i++) appendTextLine(stepsLines[i]);

      if (speakThisStep && userWantsAudio) {
        const text = stepsExplanations[idx] || "";
        if (text) await speech(text);
      }
    }
  });
}

// -----------------------------
// Sophia overlay: clearer voice capture + safe cleanup
// -----------------------------
function ensureLiveTranscriptEl() {
  if (!overlayEl) return null;
  let el = overlayEl.querySelector("#sophia-live");
  if (!el) {
    el = document.createElement("div");
    el.id = "sophia-live";
    el.style.marginTop = "12px";
    el.style.fontSize = "14px";
    el.style.opacity = "0.9";
    el.style.color = "#fff";
    const wrapper = overlayEl.querySelector(".sophia-orb-wrapper");
    if (wrapper) wrapper.appendChild(el);
  }
  return el;
}

async function startSophiaInteraction(questionObjOrString) {
  const qObj =
    typeof questionObjOrString === "string"
      ? { questionText: questionObjOrString }
      : questionObjOrString || {};

  const questionText =
    (qObj.questionText || String(questionObjOrString || "")).trim() ||
    "Answer the question.";

    // ✅ Preferred UX: show the question in the small popup and let the user type in the composer.
    // This avoids the full-screen orb overlay for in-lesson questions.
    if (questionPopupEl && questionTextEl && ask && actionBtn) {
      // Stop narration so it doesn't overlap the question moment
      try { stopSpeech(); } catch {}

      // Pause sandbox visuals while asking (do not change sandboxPaused flag; we only pause the iframe)
      const tokenAtStart = playLoopToken;
      const resumeSandbox = (lessonMode === "sandbox" && !sandboxPaused);
      try { if (lessonMode === "sandbox") sandboxPost("PAUSE"); } catch {}

      // If another inline question is already waiting, resolve it with empty answer.
      try {
        if (pendingPopupAnswer?.resolve) pendingPopupAnswer.resolve("");
      } catch {}

      // Show the question popup
      showQuestionPopup(questionText);

      // Temporarily enable the input even if the lesson is playing
      const restore = { disabled: ask.disabled, placeholder: ask.placeholder };
      ask.disabled = false;
      ask.placeholder = "Type your answer and press Enter...";
      try { ask.focus(); } catch {}

      return await new Promise((resolve) => {
        pendingPopupAnswer = { resolve, tokenAtStart, restore, resumeSandbox };
      });
    }

  // Stop narration so the mic doesn't transcribe Sophia
  try {
    stopSpeech();
  } catch {}

  // Pause sandbox visuals while asking
  const tokenAtStart = playLoopToken;
  try {
    if (lessonMode === "sandbox") sandboxPost("PAUSE");
  } catch {}

  if (!overlayEl) return "";

  // Set overlay prompt text
  const statusEl = overlayEl.querySelector(".sophia-status-text");
  if (statusEl) statusEl.textContent = questionText;

  // Show overlay (IMPORTANT: CSS has display:none !important on .sophia-hidden)
  overlayEl.classList.remove("sophia-hidden");

  // Start orb animation
  try {
    await SophiaVisualizer.startListening();
  } catch {}

  // SpeechRecognition support
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    const typed = window.prompt(questionText) || "";
    try {
      SophiaVisualizer.stopListening();
    } catch {}
    overlayEl.classList.add("sophia-hidden");
    if (tokenAtStart === playLoopToken && lessonMode === "sandbox" && !sandboxPaused) {
      try {
        sandboxPost("PLAY");
      } catch {}
    }
    return typed.trim();
  }

  // Better capture settings
  const liveEl = ensureLiveTranscriptEl();
  if (liveEl) liveEl.textContent = "";

  return await new Promise((resolve) => {
    let finalText = "";
    let interimText = "";
    let silenceTimer = null;
    let finished = false;
    let listening = true;

    // ✅ Only start the silence countdown AFTER we hear the user speak at least once
    let hasHeardSpeech = false;

    const SILENCE_MS = 2200;

    // Optional: prevents waiting forever if user never speaks
    const MAX_WAIT_MS = 20000;
    const maxWaitTimer = setTimeout(() => {
      if (!hasHeardSpeech) cleanup("");
    }, MAX_WAIT_MS);

    const cleanup = (answer) => {
      if (finished) return;
      finished = true;
      listening = false;

      if (silenceTimer) clearTimeout(silenceTimer);
      clearTimeout(maxWaitTimer);

      try {
        if (recognition) {
          recognition.onresult = null;
          recognition.onerror = null;
          recognition.onend = null;
          recognition.stop();
        }
      } catch {}

      try {
        SophiaVisualizer.stopListening();
      } catch {}

      overlayEl.classList.add("sophia-hidden");

      // Resume sandbox visuals only if:
      // - we are still on the same play token AND not paused
      if (tokenAtStart === playLoopToken && lessonMode === "sandbox" && !sandboxPaused) {
        try {
          sandboxPost("PLAY");
        } catch {}
      }

      resolve((answer || "").trim());
    };

    const resetSilence = () => {
      if (!hasHeardSpeech) return; // ✅ wait for first user input
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        const answer = (finalText + (interimText ? " " + interimText : "")).trim();
        cleanup(answer);
      }, SILENCE_MS);
    };

    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const txt = (res?.[0]?.transcript || "").trim();
        if (!txt) continue;

        hasHeardSpeech = true; // ✅ user has started speaking

        if (res.isFinal) {
          finalText += (finalText ? " " : "") + txt;
        } else {
          interimText += (interimText ? " " : "") + txt;
        }
      }

      const combined = (finalText + (interimText ? " " + interimText : "")).trim();
      if (liveEl) liveEl.textContent = combined;

      resetSilence();
    };

    recognition.onerror = () => {
      const answer = (finalText + (interimText ? " " + interimText : "")).trim();
      cleanup(answer);
    };

    recognition.onend = () => {
      // Chrome sometimes ends unexpectedly. If still listening, restart.
      if (listening && !finished) {
        try {
          recognition.start();
          return;
        } catch {}
      }
      const answer = (finalText + (interimText ? " " + interimText : "")).trim();
      cleanup(answer);
    };

    // Start recognition after a tiny delay (helps avoid capturing trailing TTS audio)
    try {
      setTimeout(() => {
        try {
          recognition.start();
        } catch (e) {
          const typed = window.prompt(questionText) || "";
          cleanup(typed);
        }
      }, 150);
    } catch (e) {
      const typed = window.prompt(questionText) || "";
      cleanup(typed);
    }
  });
}

async function processAndJudge(initialAnswer, questionObjOrString, narrationContext = "") {
  const qObj =
    typeof questionObjOrString === "string"
      ? { questionText: questionObjOrString }
      : questionObjOrString || {};

  const qText = (qObj.questionText || String(questionObjOrString || "")).trim();

  let attempt = 0;
  let answer = (initialAnswer || "").trim();

  while (attempt < 3) {
    const safeAnswer = answer.length ? answer : "I don't know";

    let result;
    try {
      // IMPORTANT: your gemini.js signature is askSophiaJudge(question, answer)
      // We keep it that way.
      result = await askSophiaJudge(qObj, safeAnswer, attempt);
    } catch (e) {
      console.error("Judge failed:", e);
      if (attempt >= 2) return true;
      try {
        await speech("I couldn’t check that answer right now. Let’s try one more time.");
      } catch {}
      attempt++;
      answer = await startSophiaInteraction(qObj);
      continue;
    }

    const isCorrect = !!result?.isCorrect;
    const shouldUnlock = !!result?.shouldUnlock || attempt >= 2;

    if (isCorrect || shouldUnlock) {
      if (result?.feedback) {
        try {
          await speech(result.feedback);
        } catch {}
      }
      return true;
    }

    // Wrong answer: speak feedback + retry
    if (result?.feedback) {
      await speech(result.feedback);
    } else {
      await speech("Not quite. Try again.");
    }

    attempt++;
    answer = await startSophiaInteraction(qObj);
  }

  return true;
}

// -----------------------------
// Play loops (audio drives step advancing)
// -----------------------------
async function playSandboxLoop(token) {
  while (token === playLoopToken && !sandboxPaused) {
    if (!sandboxState.ready) {
      await new Promise((r) => setTimeout(r, 80));
      continue;
    }

    const total = sandboxState.totalSteps || sandboxExplanations.length || 0;
    const step = clampStep(sandboxState.step, total);

    // Narration
    const narration = sandboxExplanations[step] || "";
    if (userWantsAudio && narration) {
      await speech(narration);
    }

    // Question intercept
    const question = sandboxQuestions[step];
    if (question) {
      const firstAnswer = await startSophiaInteraction(question);
      await processAndJudge(firstAnswer, question, narration);
    }

    if (token !== playLoopToken || sandboxPaused) break;
    if (total > 0 && step >= total - 1) break;

    // Advance
    sandboxPost("SEEK", { step: step + 1, instant: false });
    await waitForSandboxStep(step + 1, 3000);
    await new Promise((r) => setTimeout(r, 80));
  }
}

async function playStepsLoop(token) {
  while (token === playLoopToken && !stepsPaused) {
    const total = stepsLines.length;
    const step = clampStep(stepsIdx, total);

    // UI update
    clearFeed();
    for (let i = 0; i <= step; i++) appendTextLine(stepsLines[i]);

    // Narration
    const narration = stepsExplanations[step] || "";
    if (userWantsAudio && narration) {
      await speech(narration);
    }

    // Question intercept
    const question = stepsQuestions[step];
    if (question) {
      const firstAnswer = await startSophiaInteraction(question);
      const passed = await processAndJudge(firstAnswer, question, narration);
      if (!passed) continue;
    }

    if (token !== playLoopToken || stepsPaused) break;
    if (total > 0 && step >= total - 1) {
      setPlayPauseUI(false);
      break;
    }

    stepsIdx = step + 1;
    safeUpdateProgress();
    await new Promise((r) => setTimeout(r, 120));
  }
}

// -----------------------------
// Player buttons
// -----------------------------
playPauseBtn?.addEventListener("click", () => {
  if (lessonMode === "none") return;

  if (lessonMode === "sandbox") {
    if (!sandboxState.ready) return;

    sandboxPaused = !sandboxPaused;
    userWantsAudio = !sandboxPaused;

    setPlayPauseUI(!sandboxPaused);

    if (sandboxPaused) {
      hardStopAudio();
      playLoopToken++;
      return;
    }

    const token = ++playLoopToken;
    playSandboxLoop(token).finally(() => {
      if (token === playLoopToken) {
        sandboxPaused = true;
        userWantsAudio = false;
        setPlayPauseUI(false);
      }
    });
    return;
  }

  if (lessonMode === "steps") {
    stepsPaused = !stepsPaused;
    userWantsAudio = !stepsPaused;
    setPlayPauseUI(!stepsPaused);

    if (stepsPaused) {
      hardStopAudio();
      playLoopToken++;
      return;
    }

    const token = ++playLoopToken;
    playStepsLoop(token).finally(() => {
      if (token === playLoopToken) {
        stepsPaused = true;
        userWantsAudio = false;
        setPlayPauseUI(false);
      }
    });
  }
});

forwardBtn?.addEventListener("click", () => {
  return;
});

backBtn?.addEventListener("click", () => {
  return;
});

// -----------------------------
// Chat / Generate lesson
// -----------------------------
async function sendMessage() {
  // If we're currently answering an in-lesson question, treat the composer as the answer box.
  if (pendingPopupAnswer) {
    const answer = ask.value.trim();
    ask.value = "";
    updateActionButtonState();

    const { resolve, tokenAtStart, restore, resumeSandbox } = pendingPopupAnswer;
    pendingPopupAnswer = null;

    // Hide popup + restore input state
    hideQuestionPopup();
    if (ask) {
      ask.disabled = !!restore?.disabled;
      ask.placeholder = restore?.placeholder || "Ask Sophia anything...";
    }

    // Resume sandbox visuals only if we were playing (same rule as the orb overlay)
    if (resumeSandbox && tokenAtStart === playLoopToken && lessonMode === "sandbox" && !sandboxPaused) {
      try { sandboxPost("PLAY"); } catch {}
    }

    resolve((answer || "").trim());
    return;
  }


  const userText = ask.value.trim();
  if (!userText) return;

  if (isCourseMode) {
    handleCourseCreation(userText);
    return;
  }

  // Stop everything
  playLoopToken++;
  userWantsAudio = false;
  stepsPaused = true;
  sandboxPaused = true;
  hardStopAudio();
  setPlayPauseUI(false);

  clearFeed();
  appendTextLine("Generating lesson...");

  ask.value = "";
  updateActionButtonState();

  try {
    const rawText = await askGemini(userText);
    let lesson;

    try {
        lesson = JSON.parse(rawText);
    } catch (err) {
        // This is where the magic happens
        console.log("JSON broken, sending to fixAgent...");
        const fixedText = await fixAgent(rawText, err.message);
        lesson = JSON.parse(fixedText); 
    }

    if (lesson && typeof lesson.html === "string") {
      await loadSandboxLesson(lesson);
      return;
    }

    if (lesson && Array.isArray(lesson.steps)) {
      loadStepsLesson(lesson);
      return;
    }

    clearFeed();
  } catch (err) {
    console.error(err);
    clearFeed();
    appendTextLine(`Try again later ...`);
  }
}


async function handleCourseCreation(topic) {
  const plusBtn = document.getElementById('plusMenuBtn');
  
  clearFeed();
  appendTextLine(`Architecting your course on: ${topic}...`);
  ask.value = "";
  
  try {
    // Import and call the course generator from gemini.js
    const courseData = await courseGenerator(topic);
    
    if (courseData) {
      renderCourseSidebar(courseData);
      appendTextLine("Course generated! Check the sidebar on the left.");
    }
  } catch (err) {
    console.error(err);
    appendTextLine("Failed to generate course structure.");
  } finally {
    // Reset Course Mode
    isCourseMode = false;
    plusBtn.classList.remove('course-mode-active');
    ask.placeholder = "Ask Sophia anything...";
  }
}


// Toggle Course Mode when clicking "Create course" in dropdown
document.getElementById('createCourseBtn').addEventListener('click', () => {
  isCourseMode = true;
  const plusBtn = document.getElementById('plusMenuBtn');
  
  plusBtn.classList.add('course-mode-active'); // Add the highlight
  ask.placeholder = "Enter a topic to build a full course...";
  
  // Close dropdown
  document.getElementById('plusDropdown').classList.remove('show');
});

// Function to populate the sidebar with the new structure
function renderCourseSidebar(data) {
  const chatList = document.querySelector('.chat-list');
  chatList.innerHTML = `<div class="course-main-title">${data.course_metadata.topic}</div>`;

  data.sections.forEach(section => {
    // Add Section Heading
    const sectionHeader = document.createElement('div');
    sectionHeader.className = 'sidebar-section-header';
    sectionHeader.innerText = section.section_title;
    chatList.appendChild(sectionHeader);

    // Inside your renderCourseSidebar function:
    section.modules.forEach(mod => {
      const item = document.createElement('button');
      item.className = 'chat-item module-item';
      
      item.innerHTML = `
        <div class="module-content" style="display: flex; align-items: center; width: 100%;">
          <span class="module-title-text">${mod.title}</span>
        </div>
      `;

      // --- THE FIX: Connect clicking to the sendMessage function ---
      item.onclick = () => {
        // 1. Fill the input with a specific prompt based on the module's depth_description
        ask.value = `Teach me about ${mod.title}. Context: ${mod.depth_description}`;
        
        // 2. Ensure we aren't in Course Mode anymore (so it generates a lesson, not a new syllabus)
        isCourseMode = false;
        document.getElementById('plusMenuBtn').classList.remove('course-mode-active');
        ask.placeholder = "Ask Sophia anything...";

        // 3. Trigger the standard sendMessage function
        sendMessage();
      };
      
      item.setAttribute('title', mod.title);
      chatList.appendChild(item);
    });
  });
}

// Enter to send
ask?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !isRecording) {
    e.preventDefault();
    sendMessage();
    updateActionButtonState();
  }
});

// Main action button: mic/send/stop (kept compatible with your UI)
actionBtn?.addEventListener("click", () => {
  const hasText = ask.value.trim() !== "";
  if (isRecording) stopRecordingUI();
  else if (hasText) sendMessage();
  else startRecordingUI();
});

ask?.addEventListener("input", updateActionButtonState);

// -----------------------------
// Other UI buttons
// -----------------------------

function resumeLessonAfterInterruption() {
  if (lessonMode === "sandbox") {
    sandboxPaused = false;
    userWantsAudio = true;
    setPlayPauseUI(true);
    const token = ++playLoopToken;
    playSandboxLoop(token);
  } else if (lessonMode === "steps") {
    stepsPaused = false;
    userWantsAudio = true;
    setPlayPauseUI(true);
    const token = ++playLoopToken;
    playStepsLoop(token);
  }
}

handBtn?.addEventListener("click", async () => {
  // Visual feedback
  handBtn.classList.add("ping");
  setTimeout(() => handBtn.classList.remove("ping"), 700);

  // 1. Pause the lesson immediately
  const wasPaused = (lessonMode === "sandbox") ? sandboxPaused : stepsPaused;
  
  // Force stop current speech and loops
  hardStopAudio();
  playLoopToken++; 
  
  if (lessonMode === "sandbox") {
    sandboxPaused = true;
    sandboxPost("PAUSE");
  } else {
    stepsPaused = true;
  }
  setPlayPauseUI(false);

  // 2. Prepare Context for Gemini
  const topic = document.getElementById("ask").value || "Current Topic"; // Or grab from lesson.title
  
  let currentStepInfo = "";
  if (lessonMode === "sandbox") {
    // Get the last 2 explanations for context
    const currentIdx = sandboxState.step;
    const prevIdx = Math.max(0, currentIdx - 1);
    currentStepInfo = `Previous: ${sandboxExplanations[prevIdx]} | Current: ${sandboxExplanations[currentIdx]}`;
  } else {
    currentStepInfo = stepsExplanations[stepsIdx] || "Explaining the current concept.";
  }

  // 3. Open Sophia Interruption Overlay
  // We use your existing startSophiaInteraction to get the user's voice/text question
  const userQuestion = await startSophiaInteraction("I'm listening! What is your question?");

  if (userQuestion && userQuestion.length > 2) {
    try {
      // 4. Call the new API function
      const result = await handleInterruption(userQuestion, currentStepInfo, topic);

      // 5. Speak the answer
      // We use speech_combined which contains the acknowledgment + answer + bridge
      await speech(result.speech_combined);

      // 6. Resume if the user was playing before the interruption
      if (!wasPaused) {
        resumeLessonAfterInterruption();
      }
    } catch (err) {
      console.error("Interruption Error:", err);
      await speech("I'm sorry, I had a glitch processing that. Let's get back to the lesson.");
      if (!wasPaused) resumeLessonAfterInterruption();
    }
  } else {
    // If user cancelled or said nothing, just resume
    if (!wasPaused) resumeLessonAfterInterruption();
  }
});

fsBtn?.addEventListener("click", async () => {
  if (!screenEl) return;

  try {
    if (!document.fullscreenElement) {
      await screenEl.requestFullscreen(); /* This triggers the expansion */
      if (enterFS) enterFS.style.display = "none";
      if (exitFS) exitFS.style.display = "block";
    } else {
      await document.exitFullscreen();
      if (enterFS) enterFS.style.display = "block";
      if (exitFS) exitFS.style.display = "none";
    }
  } catch (err) {
    console.error("Fullscreen failed", err);
  }
});

document.addEventListener("fullscreenchange", () => {
  const fs = !!document.fullscreenElement;
  if (enterFS) enterFS.style.display = fs ? "none" : "block";
  if (exitFS) exitFS.style.display = fs ? "block" : "none";
});

// -----------------------------
// Recording UI (kept compatible)
// -----------------------------
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function updateRecordingTime() {
  recordingSeconds += 1;
  if (recordingTimeEl) recordingTimeEl.textContent = formatTime(recordingSeconds);
}

function startRecordingUI() {
  isRecording = true;
  recordingSeconds = 0;
  if (recordingTimeEl) recordingTimeEl.textContent = "00:00";
  if (recordingPanel) recordingPanel.style.display = "block";
  if (recordingTimer) clearInterval(recordingTimer);
  recordingTimer = setInterval(updateRecordingTime, 1000);
  updateActionButtonState();
}

function stopRecordingUI() {
  isRecording = false;
  if (recordingTimer) clearInterval(recordingTimer);
  recordingTimer = null;
  if (recordingPanel) recordingPanel.style.display = "none";
  updateActionButtonState();
}

function updateActionButtonState() {
  if (!ask) return;
  const hasText = ask.value.trim() !== "";

  if (isRecording) {
    if (micIcon) micIcon.style.display = "none";
    if (sendIcon) sendIcon.style.display = "none";
    if (stopIcon) stopIcon.style.display = "block";
  } else if (hasText) {
    if (micIcon) micIcon.style.display = "none";
    if (stopIcon) stopIcon.style.display = "none";
    if (sendIcon) sendIcon.style.display = "block";
  } else {
    if (sendIcon) sendIcon.style.display = "none";
    if (stopIcon) stopIcon.style.display = "none";
    if (micIcon) micIcon.style.display = "block";
  }
}

createCourseBtn.addEventListener('click', () => {
    isCourseMode = true;
    plusBtn.classList.add('course-mode-active'); // Highlight the button
    askInput.placeholder = "Enter a topic to create a full course...";
    document.getElementById('plusDropdown').classList.remove('show');
});

document.getElementById('plusMenuBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('plusDropdown').classList.toggle('show');
});

// Close menu on click outside
document.addEventListener('click', () => {
  document.getElementById('plusDropdown').classList.remove('show');
});


// Close both sidebars on initial load
layoutEl?.classList.add("collapsed-left", "collapsed-right");

// Toggle left sidebar
leftHeaderToggle?.addEventListener("click", () => {
  layoutEl?.classList.toggle("collapsed-left");
});

// When left is collapsed, this mini button should expand it
miniExpandLeft?.addEventListener("click", () => {
  layoutEl?.classList.remove("collapsed-left");
});

// Toggle right sidebar
rightHeaderToggle?.addEventListener("click", () => {
  layoutEl?.classList.toggle("collapsed-right");
});


// Small question popup toggle (manual)
questionBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (pendingPopupAnswer) return; // don't interrupt an in-lesson question
  const isHidden = questionPopupEl?.classList.contains("question-popup-hidden");
  if (isHidden) {
    showQuestionPopup("Type your question in the box below, then press Enter.");
    try { ask?.focus(); } catch {}
  } else {
    hideQuestionPopup();
  }
});

// Click outside closes popup (unless we're waiting on an answer)
document.addEventListener("click", (e) => {
  if (pendingPopupAnswer) return;
  if (!questionPopupEl || questionPopupEl.classList.contains("question-popup-hidden")) return;
  const wrapper = questionPopupEl.closest(".popup-wrapper");
  if (wrapper && wrapper.contains(e.target)) return;
  hideQuestionPopup();
});




// Initialize UI
setPlayPauseUI(false);
updateActionButtonState();