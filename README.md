# Revision Hub

An interactive revision app for University of Exeter students. Upload lecture slides, tutorial Q&A, and past papers. Generate AI-powered notes, practice with quizzes, and get exam preparation help.

## Features

- **Multiple modules** – Add a module for each course
- **Weekly structure** – Organise content by Week 1–11 under each module
- **File upload** – Upload multiple PDFs per week:
  - Lecture slides (e.g. part 1, part 2)
  - Tutorial questions and answers
  - Past papers
- **AI-generated notes** – Combined notes from all documents in a week
- **Interactive quiz** – Auto-generated multiple-choice questions with explanations
- **Exam help** – Tips and a catch-up plan tailored to missed lectures

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Add an API key** (required for note generation and quizzes – **free, no credit card**)
   - **OpenRouter** (recommended): Get a free key at [openrouter.ai/keys](https://openrouter.ai/keys) → add as `OPENROUTER_API_KEY`
   - **Groq** (alternative): Get a free key at [console.groq.com/keys](https://console.groq.com/keys) → add as `GROQ_API_KEY`
   - Edit **env.local**, add your key, run `npm run setup-env`, then restart the dev server

3. **Run the app**
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Data storage

All data (modules, files, notes, quizzes) is stored locally in your browser (IndexedDB). Nothing is sent to a server except text sent to OpenAI for note and quiz generation.

## PDF requirements

- PDFs must contain selectable text (not scans/images)
- If slides are image-based, use OCR tools first to convert them to text


