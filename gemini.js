// gemini.js (FRONTEND wrapper)
// Keep importing this from your HTML like before.

async function callServer(fn, args) {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fn, args })
  });

  const data = await res.json();
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || "Server error");
  }
  return data.result;
}

export async function askGemini(userPrompt) {
  return await callServer("askGemini", { userPrompt });
}

export async function askSophiaJudge(questionObj, userAnswer, attemptNumber = 0) {
  return await callServer("askSophiaJudge", { questionObj, userAnswer, attemptNumber });
}

export async function handleInterruption(userQuestion, currentStepInfo, topic) {
  return await callServer("handleInterruption", { userQuestion, currentStepInfo, topic });
}

export async function courseGenerator(courseInfo) {
  return await callServer("courseGenerator", { courseInfo });
}

export async function fixAgent(brokenJson, errorMessage, attempt = 1) {
  return await callServer("fixAgent", { brokenJson, errorMessage, attempt });
}
