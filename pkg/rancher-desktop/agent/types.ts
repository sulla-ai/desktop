// Agent System Types
// Flow: SensoryInput → ContextDetector → ConversationThread → Response

// ============================================================================
// SENSORY INPUT TYPES
// ============================================================================

export interface SensoryInput {
  id: string;
  type: 'text' | 'audio' | 'image';
  data: string;
  metadata: SensoryMetadata;
  timestamp: number;
}

export interface SensoryMetadata {
  source: 'keyboard' | 'microphone' | 'camera' | 'api' | 'calendar' | 'heartbeat';
  speaker?: string;
  language?: string;
  isBackgroundTask?: boolean;
  eventId?: number;
  eventTitle?: string;
  [key: string]: unknown;
}

// ============================================================================
// CONTEXT DETECTOR TYPES
// ============================================================================

export interface ThreadContext {
  threadId: string;
  isNew: boolean;
  summary: string;
  topic?: string;
  confidence: number;
  clearMessages?: boolean; // If true, caller should clear messages for fresh start
}

// ============================================================================
// CONVERSATION THREAD TYPES
// ============================================================================

export interface TaskState {
  // WebSocket connection ID for message routing
  wsConnectionId?: string;

  // Memory Node
  memoryContext?: string;
  memories?: unknown[];
  memorySearchPlan?: unknown;
  retrievedMemories?: unknown[];
  
  // Strategic Planner Node (high-level goals/milestones)
  strategicPlanRetryCount?: number;
  strategicPlanLastError?: string;
  strategicPlan?: {
    goal: string;
    goalDescription: string;
    milestones: Array<{
      id: string;
      title: string;
      description: string;
      successCriteria: string;
      dependsOn: string[];
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
    }>;
    requiresTools: boolean;
    estimatedComplexity: 'simple' | 'moderate' | 'complex';
  };
  activeMilestone?: {
    id: string;
    title: string;
    description: string;
    successCriteria: string;
    generateKnowledgeBase?: boolean;
    kbSuggestedSlug?: string;
    kbSuggestedTags?: string[];
  };
  
  // Tactical Planner Node (micro-plans per milestone, state-only)
  tacticalPlan?: {
    milestoneId: string;
    steps: Array<{
      id: string;
      action: string;
      description: string;
      toolHints?: string[];
      status: 'pending' | 'in_progress' | 'done' | 'failed';
    }>;
  };
  activeTacticalStep?: {
    id: string;
    action: string;
    description: string;
    toolHints?: string[];
  };
  
  // Legacy Planner Node (for backwards compatibility during transition)
  plan?: {
    intent?: { type: string; confidence: number; description: string };
    planNeeded?: boolean;
    goal?: string;
    requiresTools?: boolean;
    todos?: unknown[];
    fullPlan?: unknown;
  };
  requestPlanRevision?: { reason: string };
  revisionFeedback?: string;
  
  // Executor Node
  activePlanId?: number;
  activeTodo?: {
    id: number;
    title: string;
    description?: string;
    status?: string;
    categoryHints?: string[];
  };
  todoExecution?: {
    todoId: number;
    status: string;
    summary?: string;
    actions?: unknown[];
    actionsCount?: number;
    markDone?: boolean;
  };
  toolResults?: Record<string, unknown>;
  executionNotes?: string[];
  planHasRemainingTodos?: boolean;
  executorCompleted?: boolean;
  blockedRevisionCount?: number;
  promptPrefix?: string;
  promptSuffix?: string;
  
  // Critic Node
  criticDecision?: 'approve' | 'revise' | 'reject';
  criticReason?: string;
  finalCriticDecision?: string;
  finalCriticReason?: string;
  finalCriticSuggestedTodos?: Array<{ title: string; description?: string; categoryHints?: string[] }>;
  finalRevisionCount?: number;
  revisionCount?: number;
  
  // Graph execution
  maxIterationsReached?: boolean;
  llmFailureCount?: number;
  
  // LLM response
  response?: string;
  ollamaModel?: string;
  ollamaEvalCount?: number;
  
  // Heartbeat
  heartbeatModel?: string;
  
  // Error handling
  error?: string;

  // Knowledge graph generation (KnowledgePlanner/Executor/Critic/Writer)
  knowledgePlannerError?: string;
  knowledgeExecutorError?: string;
  knowledgeExecutorRetryCount?: number;
  knowledgeExecutorLastError?: string;
  knowledgeCriticError?: string;
  knowledgeWriterError?: string;

  // Internal event emitter (set during process())
  __emitAgentEvent?: (event: Omit<AgentEvent, 'timestamp'>) => void;
}

export interface ConversationState {
  threadId: string;
  messages: Message[];
  shortTermMemory: Message[]; // Recent 5 exchanges
  metadata: TaskState;
  createdAt: number;
  updatedAt: number;
}

// Backwards compatibility aliases
export type ThreadState = ConversationState;
export type ThreadStateMetadata = TaskState;

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface AgentResponse {
  id: string;
  threadId: string;
  type: 'text' | 'audio';
  content: string;
  refined: boolean; // Whether critique step was applied
  metadata: Record<string, unknown>;
  timestamp: number;
}

// ============================================================================
// GRAPH NODE TYPES (LangGraph-style)
// ============================================================================

export type NodeResult = 'continue' | 'end' | 'loop' | string; // string = next node name

export interface GraphNode {
  id: string;
  name: string;
  execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }>;
  initialize?(): Promise<void>;
  destroy?(): Promise<void>;
}

export interface GraphEdge {
  from: string;
  to: string | ((state: ThreadState) => string); // Static or conditional
}

export interface GraphConfig {
  nodes: GraphNode[];
  edges: GraphEdge[];
  entryPoint: string;
  endPoints: string[];
}

// ============================================================================
// PLUGIN TYPES (Legacy - for backward compatibility)
// ============================================================================

export interface PluginConfig {
  id: string;
  name: string;
  order: number;
  enabled: boolean;
  settings: Record<string, unknown>;
}

export interface Plugin {
  config: PluginConfig;
  initialize?(): Promise<void>;
  beforeProcess?(state: ThreadState): Promise<ThreadState>;
  process?(state: ThreadState): Promise<ThreadState>;
  afterProcess?(state: ThreadState): Promise<ThreadState>;
  destroy?(): Promise<void>;
}

// ============================================================================
// EVENT TYPES (for streaming/progress updates)
// ============================================================================

export interface AgentEvent {
  type: 'progress' | 'chunk' | 'complete' | 'error';
  threadId: string;
  data: unknown;
  timestamp: number;
}

export type AgentEventHandler = (event: AgentEvent) => void;
