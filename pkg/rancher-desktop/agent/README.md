# Sulla Agent Application

A modular, pluggable multi-agent reasoning system for processing user inputs through a configurable pipeline.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INPUT                                      │
│                         (text, audio, etc.)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SENSORY                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  processText(text) / processAudio(audio)                            │    │
│  │  - Accepts raw input from user                                      │    │
│  │  - Creates SensoryInput object                                      │    │
│  │  - Triggers AgentApplication.process()                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENT APPLICATION                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Creates AgentContext:                                              │    │
│  │  {                                                                  │    │
│  │    rawInput: "user's original text",                                │    │
│  │    prompt: "user's original text",  // modified by plugins          │    │
│  │    response: "",                    // set by LLM plugin            │    │
│  │    metadata: {},                    // plugins can store data       │    │
│  │    functionCalls: [],               // for tool/function calling    │    │
│  │    errors: [],                      // error collection             │    │
│  │    timestamp: 1234567890                                            │    │
│  │  }                                                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    PLUGIN PIPELINE                                  │    │
│  │                                                                     │    │
│  │  Plugins sorted by `order` (lower = earlier)                        │    │
│  │                                                                     │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │ PHASE 1: beforeProcess()                                      │  │    │
│  │  │ - Modify prompt before LLM call                               │  │    │
│  │  │ - Retrieve context from memory/vector DB                      │  │    │
│  │  │ - Add system instructions                                     │  │    │
│  │  │ - Validate/sanitize input                                     │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  │                              │                                      │    │
│  │                              ▼                                      │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │ PHASE 2: process()                                            │  │    │
│  │  │ - Main processing (LLM calls happen here)                     │  │    │
│  │  │ - OllamaPlugin calls /api/generate                            │  │    │
│  │  │ - Sets context.response                                       │  │    │
│  │  │ - Execute function calls                                      │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  │                              │                                      │    │
│  │                              ▼                                      │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │ PHASE 3: afterProcess()                                       │  │    │
│  │  │ - Modify/format response                                      │  │    │
│  │  │ - Store conversation in memory                                │  │    │
│  │  │ - Log analytics                                               │  │    │
│  │  │ - Trigger side effects                                        │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Returns AgentResponse:                                             │    │
│  │  {                                                                  │    │
│  │    type: "text",                                                    │    │
│  │    data: "The AI's response...",                                    │    │
│  │    context: { ...full AgentContext for debugging }                  │    │
│  │  }                                                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RESPONSE                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  formatText(agentResponse) → string                                 │    │
│  │  formatAudio(agentResponse) → audio data (future)                   │    │
│  │  hasErrors(agentResponse) → boolean                                 │    │
│  │  getErrors(agentResponse) → string[]                                │    │
│  │  getContext(agentResponse) → full context for debugging             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER OUTPUT                                     │
│                         (displayed in UI)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
agent/
├── index.ts              # Main exports
├── types.ts              # TypeScript interfaces
├── AgentApplication.ts   # Core orchestrator
├── Sensory.ts            # Input handling
├── Response.ts           # Output handling
├── README.md             # This file
└── plugins/
    ├── BasePlugin.ts     # Abstract base class
    └── OllamaPlugin.ts   # LLM integration
```

## Core Classes

### AgentApplication
The central orchestrator that manages plugins and runs the processing pipeline.

```typescript
const agent = getAgentApplication();

// Register plugins (sorted by order automatically)
agent.registerPlugin(new OllamaPlugin());
agent.registerPlugin(new MyCustomPlugin());

// Process input
const response = await agent.process(sensoryInput);
```

### Sensory
Handles input from various sources and triggers the agent pipeline.

```typescript
const sensory = getSensory();

// Process text input
const response = await sensory.processText("Hello, how are you?");

// Future: Process audio input
// const response = await sensory.processAudio(audioData);
```

### Response
Handles output formatting and error inspection.

```typescript
const responseHandler = getResponse();

// Get text response
const text = responseHandler.formatText(agentResponse);

// Check for errors
if (responseHandler.hasErrors(agentResponse)) {
  console.error(responseHandler.getErrors(agentResponse));
}

// Debug: get full context
const ctx = responseHandler.getContext(agentResponse);
```

## Plugin System

### Plugin Interface

```typescript
interface Plugin {
  config: PluginConfig;
  
  initialize?(): Promise<void>;           // Called once on registration
  beforeProcess?(ctx): Promise<ctx>;      // Before LLM call
  process?(ctx): Promise<ctx>;            // Main processing (LLM calls)
  afterProcess?(ctx): Promise<ctx>;       // After LLM call
  destroy?(): Promise<void>;              // Cleanup
}

interface PluginConfig {
  id: string;           // Unique identifier
  name: string;         // Display name
  order: number;        // Execution order (lower = earlier)
  enabled: boolean;     // Toggle on/off
  settings: object;     // Plugin-specific config
}
```

### Creating a Plugin

```typescript
import { BasePlugin } from './plugins/BasePlugin';
import type { AgentContext } from './types';

export class MyPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'my-plugin',
      name: 'My Custom Plugin',
      order: 25,  // Runs before OllamaPlugin (order: 50)
    });
  }

  async beforeProcess(context: AgentContext): Promise<AgentContext> {
    // Modify the prompt before LLM sees it
    context.prompt = `You are a helpful assistant.\n\nUser: ${context.prompt}`;
    return context;
  }

  async afterProcess(context: AgentContext): Promise<AgentContext> {
    // Log the interaction
    console.log('User asked:', context.rawInput);
    console.log('AI responded:', context.response);
    return context;
  }
}
```

### Plugin Execution Order

Plugins are sorted by their `order` property:

| Order | Plugin Type | Purpose |
|-------|-------------|---------|
| 0-24  | Input Processing | Validation, sanitization |
| 25-49 | Context Retrieval | Memory, RAG, history |
| 50    | **OllamaPlugin** | LLM call |
| 51-74 | Response Processing | Formatting, filtering |
| 75-99 | Storage/Logging | Save to DB, analytics |

### Example: Multi-Agent Review System

```typescript
// Reviewer plugin that runs after initial LLM response
class ReviewerPlugin extends BasePlugin {
  constructor() {
    super({ id: 'reviewer', name: 'Response Reviewer', order: 55 });
  }

  async afterProcess(context: AgentContext): Promise<AgentContext> {
    // Call LLM again to review the response
    const reviewPrompt = `Review this response for accuracy:\n${context.response}`;
    
    const review = await this.callOllama(reviewPrompt);
    
    // Store review in metadata
    context.metadata.review = review;
    
    // Optionally modify response based on review
    if (review.includes('NEEDS_CORRECTION')) {
      context.response = await this.callOllama(
        `Correct this response: ${context.response}`
      );
    }
    
    return context;
  }
}
```

## Data Flow Example

```
1. User types: "What is 2+2?"

2. Sensory.processText("What is 2+2?")
   └─► Creates SensoryInput { type: 'text', data: 'What is 2+2?' }

3. AgentApplication.process(input)
   └─► Creates AgentContext {
         rawInput: "What is 2+2?",
         prompt: "What is 2+2?",
         response: "",
         ...
       }

4. PHASE 1 - beforeProcess (all plugins, sorted by order)
   └─► ContextPlugin (order: 25) might add:
       context.prompt = "Previous context...\n\nUser: What is 2+2?"

5. PHASE 2 - process (all plugins, sorted by order)
   └─► OllamaPlugin (order: 50):
       - Calls POST /api/generate with context.prompt
       - Sets context.response = "2+2 equals 4."

6. PHASE 3 - afterProcess (all plugins, sorted by order)
   └─► MemoryPlugin (order: 75) might:
       - Store conversation in vector DB
       - Log analytics

7. Returns AgentResponse {
     type: 'text',
     data: '2+2 equals 4.',
     context: { ...full context }
   }

8. Response.formatText(agentResponse)
   └─► Returns "2+2 equals 4."

9. UI displays: "2+2 equals 4."
```

## Usage in Agent.vue

```typescript
import { getAgentApplication, getSensory, getResponse, OllamaPlugin } from '@pkg/agent';

// Initialize
const agent = getAgentApplication();
const sensory = getSensory();
const responseHandler = getResponse();

// Register plugins
agent.registerPlugin(new OllamaPlugin());

// Handle user input
const send = async () => {
  const agentResponse = await sensory.processText(userQuery);
  
  if (responseHandler.hasErrors(agentResponse)) {
    showError(responseHandler.getErrors(agentResponse).join('; '));
  } else {
    showResponse(responseHandler.formatText(agentResponse));
  }
};
```
