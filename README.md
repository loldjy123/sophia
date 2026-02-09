# sophia
Sophia is a visual-first AI tutor that explains complex algorithm step by step using visuals, explanations, and questions.


🌸 Sophia — Visual-First AI Tutor

Sophia is an experimental AI-powered, visual-first tutoring system designed to help students actually understand complex topics — not just get answers.

Instead of dumping text or rushing through solutions, Sophia teaches like a human tutor:

visually,

step by step,

with narration,

questions,

and interactive explanations.

The goal is simple: learning that sticks.

✨ Core Idea

Many existing tutorials (videos, blogs, even AI chats) suffer from one or more problems:

You can’t ask questions at the right moment

Explanations move too fast or assume prior knowledge

Visuals are static or disconnected from the explanation

AI answers often shortcut thinking instead of building it

Sophia is built to solve this.

She explains concepts as a lesson, not a reply.

🧠 What Sophia Does

Sophia can:

Explain algorithms and technical concepts from scratch

Generate visual boards (SVG-based animations, diagrams, graphs)

Narrate explanations using natural voice

Pause, resume, and step through lessons

Ask conceptual questions at key moments (Socratic style)

Judge answers gently and give hints instead of spoilers

Let learners ask questions mid-lesson (text or voice)

All of this happens inside a single interactive learning canvas.

🖥️ User Experience

Left sidebar: lecture history / sessions

Center screen: the lesson board (visuals + progression)

Bottom composer: ask questions, speak, or generate lessons

Controls: play, pause, step forward/back, fullscreen

Optional voice mode: Sophia speaks, listens, and responds

The interface is designed to feel closer to a private tutor than a chatbot.

🏗️ Architecture Overview

Sophia is currently a frontend-first prototype, built with modular JavaScript:

index.html      → App shell & layout
chat.css        → UI, layout, animations, visual system
script.js       → Lesson flow, controls, state machine
gemini.js       → AI lesson generation & judging logic
voice.js        → Text-to-speech (narration)

Key concepts:

Lesson Mode: AI returns structured lesson data (HTML + steps + explanations)

Sandbox Mode: Lessons run inside a sandboxed iframe

Visual/Narration Separation:
Visuals show what happens, narration explains why

No overwriting: Past visuals stay on the board like a real classroom

🎨 Visual-First Learning Philosophy

Sophia follows strict teaching rules:

One board, no page switching

Minimal text on visuals (≤ 12 characters per label)

No bullet points or paragraphs on the board

Motion, color, and highlighting replace long explanations

Explanations live in narration, not visuals

This keeps learners focused on understanding behavior, not memorizing steps.

🎙️ Voice & Interaction

Sophia supports:

Spoken explanations (TTS)

Voice input for answering questions

Smart silence detection (no awkward cutoffs)

Immediate interruption (“raise hand” behavior)

Voice is optional — everything also works via text.

🔐 Important Security Notice (Read This)

This repository is a prototype.

⚠️ Do NOT use this setup in production as-is.

Currently:

AI API calls are made directly from the browser

API keys must NOT be committed or exposed publicly

Recommended production setup:

Move all AI calls to a backend (Node / Python / serverless)

Store API keys in environment variables

Call your backend from the frontend

Add usage limits and rate-limiting

If you fork this repo, remove all API keys immediately.

🚀 Getting Started (Local)

Clone the repo

Open index.html in a local server (recommended)

python -m http.server


Open http://localhost:8000 in your browser

Ask Sophia a question and start learning

🧪 Current Status

✅ Core lesson engine working

✅ Visual sandbox + narration sync

✅ Interactive questions & judging

⚠️ API security not production-ready

⚠️ Rapid iteration / experimental features

Sophia is actively evolving.

🌱 Vision

Sophia is not meant to replace teachers or students’ thinking.

She is designed to:

slow learning down when needed

make abstract ideas concrete

encourage curiosity instead of shortcuts

support deep understanding through visuals

Long-term, Sophia aims to become a personal learning companion — especially for students who struggle with traditional explanations.

🧑‍💻 Author

Built by Christian Germain
Computer Science student, passionate about education, AI, and human-centered learning.
