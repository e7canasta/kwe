# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
yarn dev              # Start Next.js dev server (requires LangGraph server running)
yarn build            # Production build
yarn start            # Start production server

# Code quality
yarn lint             # Run ESLint
yarn lint:fix         # Fix ESLint issues
yarn format           # Format code with Prettier
yarn format:check     # Check formatting

# Testing
yarn eval             # Run vitest evaluations
```

## Required Services

Before running the app, these services must be running:

1. **LangGraph Server** (port 54367): Run `npx @langchain/langgraph-cli dev --port 54367` from the monorepo root
2. **Supabase**: Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env`

## Architecture

### State Management

The app uses React Context for state, with four main providers:

- **GraphContext** (`src/contexts/GraphContext.tsx`): Core streaming logic for LangGraph communication, artifact state, and message handling. Handles real-time streaming via `StreamWorkerService`.
- **ThreadProvider** (`src/contexts/ThreadProvider.tsx`): Thread/conversation management
- **AssistantContext** (`src/contexts/AssistantContext.tsx`): Assistant configuration and selection
- **UserContext** (`src/contexts/UserContext.tsx`): User authentication state

### Key Components

- **Canvas** (`src/components/canvas/`): Main split-view with chat and artifact editor
- **Artifacts** (`src/components/artifacts/`): Code editor (CodeMirror) and text editor (BlockNote) renderers
- **Chat Interface** (`src/components/chat-interface/`): Chat messages, composer, model selector

### Shared Package

Types and utilities are imported from `@opencanvas/shared`:
- `@opencanvas/shared/types` - TypeScript types (ArtifactV3, GraphInput, etc.)
- `@opencanvas/shared/models` - Model configuration constants
- `@opencanvas/shared/utils/artifacts` - Artifact type guards and utilities

### API Routes

- `src/app/api/[..._path]/route.ts` - Proxy to LangGraph server
- `src/app/api/store/` - KV store operations for thread data
- `src/app/api/whisper/audio/` - Audio transcription via Groq

## Model Configuration

To add a new LLM model:
1. Add to model provider variables in `constants.ts`
2. Install provider package (e.g., `@langchain/anthropic`)
3. Update `getModelConfig` in the shared package's `src/agent/utils.ts`

## ESLint Rules

- Unused vars must be prefixed with `_` or `UNUSED_`
- `@typescript-eslint/no-explicit-any` is disabled
- Unused imports trigger errors
