# AI Coding Assistant

A polished AI coding assistant with chat interface.

## Features

- Chat with AI for coding help
- Read project files
- Write new code
- Execute commands
- Model-agnostic (currently OpenAI, extendable to Anthropic, Google, local models)
- Modes: Active development (edit freely), Planning (read-only, ask permission)

## Setup

1. Clone the repo
2. Install dependencies: `npm install`
3. Set API key: create `.env.local` with `OPENAI_API_KEY=your_key`
4. Run: `npm run dev`

## Usage

Select mode, chat with the AI. It can read files, write code, run commands based on mode.

## Extending to other models

Add logic in `/api/chat/route.js` to switch providers based on config.

For local models, integrate with Ollama or similar.