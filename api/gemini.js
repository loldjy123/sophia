
async function askGemini(userPrompt) {

    const API_KEY = process.env.GEMINI_KEY;

    
    // Notice the endpoint uses :generateContent and passes the key in the URL
    const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`;
    //const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    

    const promptInstructions = `
            Role: You are a world-class tutor specializing in Visual-First Interactive Learning.
            Your main goal is to make a topic understandable to anyone with no prior knowledge using a Socratic, conversational approach.
            Do not rush to solve the problem, take time to explain concept. With visual and explanation

            Task:
            
            Fully explain and visually demonstrate the following topic: "${userPrompt}"

            For algorithm:
              - Introduction:
                - Fully and clearly introduce the algorithm and its real-world purpose.
                - MANDATORY Real-World Animation: 
                    - Create a simple SVG (circles for nodes, lines for paths).
                    - YOU MUST include a <style> block inside the SVG with @keyframes.
                    - The animation MUST show motion (e.g., a 'car' circle moving along a 'path' line or a 'packet' pulse).
                    - Do not just describe it; the CSS animation property MUST be applied to an element (e.g., animation: move 3s infinite linear).
                  - Clearly state the Expected Input (types and constraints) and the Expected Output.
                  - Do NOT use bullet points on the board. Use only minimal labels (<=12 chars). Put all bullet-style explanation in explanations[].
                  - State the chosen approach (e.g., Greedy, Dynamic Programming) and the Data Structures required.

              - Development (Conceptual Overview)
                - Do not use same example as the real world.
                - ExampleLayout: When showing an example (e.g., graph + table), wrap them in a 2-column flexbox container so they remain side-by-side for a split-screen effect.
                - Always visually highlight the element currently being explained.
                - Highlighting MUST be visual-only 
                - The board shows how the structure behaves, not how it is explained.
                - Use:
                  - movement (enqueue/dequeue, push/pop)
                  - highlighting (active node, current index)
                  - spatial layout (before vs after)
                - Do NOT show:
                  - algorithm steps
                  - numbered lists
                  - rule descriptions
                - The learner should be able to observe change, while the narration explains why it happens.

              
              -Implementation (The Build):
                - Code Construction: Gradually build the algorithm in the visual column one line at the time.
                - The "Why" Narrative: explain the logic behind the code being added.

              - Conclusion
                - Wrap up with an Analysis and summary

            Return: Your response must consist ONLY of the JSON object. Do not include a greeting or markdown code blocks.

            SCHEMA (EXACT KEYS, FLEXIBLE LENGTHS):
            {
              "title": "Title of the topic",
              "html": "<!doctype html>...</html>",
              "explanations": ["string", "string", "..."],
              "questions": [null, {"questionText":"string","expectedContext":"string","hints":["Conceptual clue","Strong hint"]}, null, "..."]
            }


            RULES FOR "html": 
            1) Must be a COMPLETE HTML document. All CSS/JS inside. No external files.
            2) Define window.lessonControl:
              - .totalSteps (number)
              - .goToStep(index, instant) => Promise
              - .getState() => { step, totalSteps }
              - .highlightElement(selector) => /* Visual feedback for hints/errors */
            3) Show title in the html, it should not be a step.
            4) BACKGROUND MUST BE Transparent.
            5) Show visual ONLY when it is time to talk about it (opacity 0 -> 1).
            6) Use ONE screen/canvas only. Vertical scrolling allowed. Do not erase past visuals.
            7) Step 0 must be visible immediately (add class visible to #step-0 in the initial HTML), even before any goToStep calls.

            BOARD VS NARRATION SEPARATION (MANDATORY)
            - The HTML canvas is VISUAL-ONLY.
            - The board may contain ONLY:
            - Shapes (nodes, edges, boxes, arrows)
            - Minimal labels (single words or symbols only)
            - Examples: i, dist, queue, current, visited
            - Highlights, motion, color changes, opacity changes
            - The board MUST NOT contain:
            - Sentences
            - Explanatory phrases
            - Step descriptions
            - Paragraphs or bullet lists
            - ALL explanation, reasoning, and teaching MUST go in explanations[], not in the HTML.
            - If a concept needs explanation, show it visually and explain it narratively, never with text on the board.

            TEXT DENSITY CAP (MANDATORY)
            - No visual element may contain more than 12 characters of text.
            - No more than 5 text labels visible at once on the board.
            - If more explanation is needed, use:
            - color
            - motion
            - highlighting
            - sequencing
            - narration in explanations[]
            - Forbidden HTML text tags for explanations: do not use <p>, <li>, <ul>, <ol> for teaching text on the board.
            - Allowed: SVG <text> only for short labels (<=12 chars).



            RULES FOR INTERACTION & SOCRATIC METHOD:
             - Array Sync: questions array MUST be the same length as explanations.
             - Judge’s Key: expectedContext must be a 1-2 sentence summary of the "Target Logic" for an external evaluator.
             - Hint Progression: Provide exactly 2 hints in hints[]: ["Conceptual clue","Strong hint"].
             - Cognitive Triggers: Do not use fixed patterns. Ask questions only at:
             - Prediction: Before a major reveal (Guess what happens next).
             - Interpretation: After a visual change (Why did that happen?).
             - Assumption Check: When a new rule is introduced (Why do we need this?).
             - Selective Usage: Use null for straightforward steps. Quality over quantity.
             - The Lead-In: If a question exists at step i, explanations[i] must naturally transition into the query.
             - The Bridge: explanations[i+1] must start with a phrase that acknowledges the previous answer (e.g., "Whether you guessed it or not, the key reason is...") to ensure continuity.


            
            CRITICAL OUTPUT CONTRACT (JSON ENVELOPE GUARDS)
              1) RESPONSE MUST BE EXACTLY ONE JSON OBJECT.
              2) THE FIRST CHARACTER OF THE ENTIRE RESPONSE MUST BE: {
              3) THE LAST CHARACTER OF THE ENTIRE RESPONSE MUST BE: }
              4) NO NON-JSON TEXT BEFORE OR AFTER THE JSON OBJECT. The response must start at the first '{' and end at the final '}'.
              5) NO MARKDOWN OF ANY KIND (NO  CODE FENCES, NO BULLETS OUTSIDE JSON, NO PREAMBLE).

            CRITICAL FOR JSON VALIDITY (MUST FOLLOW)
              A) JSON STRUCTURE
              - Entire response MUST be valid JSON that parses wi   th JSON.parse().
              - Output ONLY the JSON object. No surrounding text.
              - If you are about to output anything that is not valid JSON, STOP and fix it internally.
              - Ensure no literal tab characters exist; use spaces for indentation if needed.

              B) THE QUOTE RULE (STRICT)
              - Use DOUBLE QUOTES (") ONLY for JSON keys and JSON string boundaries.
              - Inside the "html" string: DO NOT use ANY DOUBLE QUOTES (") at all.
                - ALL HTML attributes MUST use SINGLE QUOTES: class='x' (NEVER class="x").
                - ALL CSS strings and ALL JavaScript strings inside "html" MUST use SINGLE QUOTES too.
              - Do NOT use HTML entities for quotes inside <script> or <style>:
                - NEVER use &apos; or &quot;. Use raw single quotes (').

              C) SINGLE-LINE HAMMER (STRICT)
              - The value of "html" MUST be ONE continuous JSON string with NO literal line breaks.
              - Do NOT press Enter inside the "html" value.
              - Represent newlines ONLY as \\n inside the JSON string.
              - Same rule applies to any JSON string fields that could accidentally include literal newlines.

              D) BACKSLASH + ESCAPING RULES (STRICT)
              - Any backslash that must appear in the final HTML/CSS/JS MUST be DOUBLE-ESCAPED in JSON.
                Examples:
                - Final newline \n  => write \\n in JSON
                - Final regex \d    => write \\d in JSON
                - Final LaTeX \frac => write \\frac in JSON
              - In other words: every "\" inside JSON strings must be written as "\\".

              E) SCRIPT TAG SAFETY (STRICT)
              - NEVER output a raw </script> inside the "html" string (it can break parsing/injection).
              - Always write the closing tag as: <\\/script>

              F) CODE RESTRAINTS (STRICT)
              - NO BACKTICKS anywhere in the JSON (including inside "html").
              - NO single-line comments (//) anywhere. Use /* ... */ only.

            SANITY CHECK BEFORE OUTPUT (DO INTERNALLY, DO NOT PRINT)
              - Confirm the response starts with { and ends with }.
              - Confirm there is exactly ONE top-level JSON object.
              - Confirm "html" contains:
                - NO double quotes (")
                - NO literal newlines (only \\n)
                - NO </script> (must be <\\/script>)
                - NO backticks 
                - NO // comments
              - Confirm all backslashes are doubled (\\).



            EXPLANATIONS:
            - explanations.length MUST equal totalSteps.
            - explanations[i] MUST match what visually happens at step i.
            - Give details explanation. Do not try to rush the explanation



            CRITICAL FOR TOKEN LIMITS:
              - The total response must be under 200 000 characters. 

            SINGLE-BOARD TEACHING MODEL (MANDATORY):
            - The lesson uses ONE screen and ONE canvas only (like a classroom board).
            - There are NO separate panels, pages, or screens.

            TEXT VS VISUAL USAGE:
              - Every key concept must be visually represented.
              - Visuals may stay static or unchanged.
            
            

            NON-OVERWRITE RULE:
            - Never erase or overwrite previously revealed notes or visuals.
            - Always append, reveal, or highlight.
            - Think “writing more on the same board”, not “clearing the board”.

            SCROLLING BEHAVIOR:
            - The canvas may grow vertically.
            - Scrolling is allowed and encouraged to move forward through steps.
            - Past notes and visuals remain visible for reference.


           SVG Visual:
            - When talking about an element, highlight it (variables, path, node, index, etc.).
            - Scroll/pan as we explain so the active area stays in view.
            - Keep past visuals on screen like a board (don’t erase previous steps).

            Tone and Pedagogy (Mandatory):
              - MAKE SURE YOU SOUNDS LIKE A FRIENDLY HUMAN
              - Speak like a peer helping a friend. 
              - Keep it punchy but warm.
              - Use natural paragraph connectors.
              - Always explain Why before How
              - Use analogies, metophors and anecdocte to explain.            
                

    `;

    

    // Request body
    const body = {
        contents: [{ parts: [{ text: promptInstructions }] }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 65535,
            responseMimeType: "application/json"
        }
    };

    const res = await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error: ${res.status} ${res.statusText}\n${errText}`);
    }

    const data = await res.json();

    // Extract the returned text (depends on API shape)
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    console.log(text);
    return text;
}

export async function askSophiaJudge(questionObj, userAnswer, attemptNumber = 0) {
  const apiKey = process.env.GEMINI_KEY;

  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

  // Normalize inputs (works even if caller passes a string by mistake)
  const q = (typeof questionObj === "string")
    ? { questionText: questionObj, expectedContext: "", hints: [] }
    : (questionObj || {});

  const questionText = String(q.questionText || "").trim();
  const expectedContext = String(q.expectedContext || "").trim();
  const hints = Array.isArray(q.hints) ? q.hints : [];

  const judgePrompt = `
  Role: You are the "tutoAI Judge" — supportive, precise, and conceptually flexible.

   You are given:
  - QuestionText
  - ExpectedContext (the answer-key logic)
  - UserAnswer
  - Hints (array of up to 2 hints:> conceptual -> strong)
  - AttemptNumber (0, 1)
  - Optional NarrationContext (what the tutor just explained)

  Return ONLY valid JSON. No markdown. No extra text.

  Schema:
  {
    "isCorrect": boolean,
    "feedback": "string",
    "shouldUnlock": boolean
  }

  Rules:
  1) Be conceptually flexible. If the user describes the correct idea in their own words, mark correct.
  2) If UserAnswer is gibberish, too short (<3 chars), or "idk/help/no idea/??", treat as wrong but be gentle and provide the hint for the current AttemptNumber.
  3) If wrong:
    - feedback should be 1–2 sentences: encourage + give the appropriate hint.
  4) shouldUnlock:
    - true if isCorrect is true
    - OR true if attemptNumber >= 1 (prevents getting stuck)

  Inputs:
  QuestionText: ${JSON.stringify(questionText)}
  ExpectedContext: ${JSON.stringify(expectedContext)}
  UserAnswer: ${JSON.stringify(String(userAnswer || ""))}
  Hints: ${JSON.stringify(hints)}
  AttemptNumber: ${Number(attemptNumber) || 0}
  `.trim();

  const body = {
    contents: [{ parts: [{ text: judgePrompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Judge API error: ${res.status} ${res.statusText}\n${errText}`);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Robust JSON extraction
  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Judge did not return valid JSON. Raw: ${rawText.slice(0, 200)}`);
  }

  const parsed = JSON.parse(rawText.slice(start, end + 1));

  // Normalize and fail-open
  const isCorrect = !!parsed.isCorrect;
  const shouldUnlock = !!parsed.shouldUnlock || (!isCorrect && (Number(attemptNumber) >= 2));
  const feedback =
    (typeof parsed.feedback === "string" && parsed.feedback.trim())
      ? parsed.feedback.trim()
      : (isCorrect ? "Exactly — you’ve got it." : "Not quite. Try again.");

  return { isCorrect, shouldUnlock, feedback };
}

export async function handleInterruption(userQuestion, currentStepInfo, topic){
  const apiKey = process.env.GEMINI_KEY;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;


  const get_question = `
  Role: You are the Real-Time Interaction Module for Sophia, an AI educator. 
  Your role is to act as a supportive, witty, and highly contextual tutor who handles student inquiries during a live-rendered lesson.

  Task: Analyze the user’s question in the context of the current lesson step. 
  Provide a concise answer (max 3 sentences) that clears up their confusion and smoothly bridges back to the original explanation.

  Context:
  {
    "mode": "Q&A_INTERRUPT", 
    "context": {
      "topic": "${topic}",
      "explanation_history": "${currentStepInfo}"
    },
    "question": "${userQuestion}"
  }

  Constraints:
  - Answer ONLY the question asked. 
  - Do not generate any HTML, JS, or CSS.
  - Keep the tone consistent with a helpful teacher.
  - If the question is irrelevant, gently redirect to the topic.

  Return ONLY valid JSON. No markdown. No extra text.

  Schema:
  {
    "acknowledgment": "A brief phrase recognizing the hand raise.",
    "answer": "The direct answer to the question.",
    "bridge": "The transition back to the lesson (e.g. 'Ready to continue?')",
    "speech_combined": "The full text to be spoken by TTS. Escape all double quotes properly."
  }
  `;

  const body = {
        contents: [{ parts: [{ text: get_question }] }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
            responseMimeType: "application/json"
        }
    };

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error: ${res.status} ${res.statusText}\n${errText}`);
    }

    const data = await res.json();

    // Extract the returned text (depends on API shape)
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    try {
        // This ensures that what you return is a ready-to-use Object, 
        // and verifies the AI followed your schema.
        const parsed = JSON.parse(text);
        return parsed; 
    } catch (e) {
        console.error("Failed to parse Sophia's response:", text);
        return {
            acknowledgment: "That's an interesting point.",
            answer: "I'm having a little trouble processing that question right now.",
            bridge: "Shall we continue with the lesson?",
            speech_combined: "That's an interesting point. I'm having a little trouble processing that question right now. Shall we continue with the lesson?"
        };
    }

}

async function courseGenerator(courseInfo){

  const API_KEY = process.env.GEMINI_KEY;

  
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`;

  const course_prompt = `
    Role: You are the Lead Syllabus Architect for Sophia, an AI Tutor.
    Goal: Deconstruct a topic into a multi-section mastery course.

    JSON Schema:
    {
      "course_metadata": { "topic": "", "overview": "" },
      "sections": [
        {
          "section_title": "String",
          "modules": [
            {
              "title": "String",
              "depth_description": "String"
            }
          ]
        }
      ]
    }

    Rules:
    1. Multi-Section: Break the course into logically grouped sections (e.g., Fundamentals, Intermediate, Advanced).
    2. Symmetry: Every module title must have a corresponding 'depth_description'.
    3. Detail: The 'depth_description' must be a roadmap for Sophia to generate the actual lesson content later.
    4 - Atomic Lessons: Do not cover many things in one module; focus on exactly one concept per module.
    5- Make the title of the modules short. just 2 - 3 words
    6- Comprehensive Intro: The first module's 'depth_description' must be a detailed narrative summary of the entire syllabus, intended to serve as a video script for the course trailer.
    It must be strictly informational; DO NOT include any questions for the user or requests for feedback in this introduction.

    

    Strict Rules for Course Structure:
    1. Global Intro: The very first module of the very first section MUST be an introduction to the entire course.
    2. Section Intro: The first module of every subsequent section MUST be an introduction to that specific section's goals.
    3. Logical Progression: Ensure modules move from theory to application.


    Return ONLY the JSON object. Do not include conversational text or markdown code blocks.

    topic: ${courseInfo}

`;


  const body = {
    contents: [{ parts: [{ text: course_prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 65535,
      responseMimeType: "application/json"
    }
  };

  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${res.statusText}\n${errText}`);
  }

  const data = await res.json();

  // 2. Extract the string
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  try {
    console.log(text);
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse Gemini response as JSON:", text);
    throw new Error("Invalid course data received.");
  }
}

async function fixAgent(brokenJson, errorMessage, attempt = 1) {
  const MAX_ATTEMPTS = 3;
  
  if (attempt > MAX_ATTEMPTS) {
    throw new Error(`fixAgent: Failed to repair JSON after ${MAX_ATTEMPTS} attempts.`);
  }

  const API_KEY = process.env.GEMINI_KEY;
  
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`;

  // I merged the data directly into the prompt for clarity
  const prompt = `You are a JSON Repair Expert. 
    Fix syntax errors (missing commas, unclosed brackets, quotes) in this JSON.
    Return ONLY the raw, valid JSON. No explanations, no markdown blocks.

    Error context: ${errorMessage}
    
    Broken JSON:
    ${brokenJson}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }], 
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 65535,
      responseMimeType: "application/json"
    }
  };

  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  let text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Standard cleanup for AI responses
  text = text.replace(/```json|```/g, "").trim();

  try {
    JSON.parse(text); 
    console.log(`✅ Success! JSON fixed on attempt ${attempt}`);
    return text; 
  } catch (parseError) {
    console.warn(`⚠️ Attempt ${attempt} failed. New error: ${parseError.message}. Retrying...`);
    return await fixAgent(text, parseError.message, attempt + 1);
  }
}


export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { fn, args } = req.body || {};
    if (!fn) return res.status(400).json({ error: "Missing fn" });

    let result;

    if (fn === "askGemini") {
      result = await askGemini(args?.userPrompt);
    } else if (fn === "askSophiaJudge") {
      result = await askSophiaJudge(args?.questionObj, args?.userAnswer, args?.attemptNumber);
    } else if (fn === "handleInterruption") {
      result = await handleInterruption(args?.userQuestion, args?.currentStepInfo, args?.topic);
    } else if (fn === "courseGenerator") {
      result = await courseGenerator(args?.courseInfo);
    } else if (fn === "fixAgent") {
      result = await fixAgent(args?.brokenJson, args?.errorMessage, args?.attempt);
    } else {
      return res.status(400).json({ error: `Unknown fn: ${fn}` });
    }

    return res.status(200).json({ ok: true, result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}
