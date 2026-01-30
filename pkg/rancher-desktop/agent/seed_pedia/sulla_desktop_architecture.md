# Sulla Desktop Architecture

Core components:

- Conversation runtime: desktop/pkg/rancher-desktop/agent/ConversationThread.ts
- Graph orchestration: desktop/pkg/rancher-desktop/agent/Graph.ts
- Nodes: desktop/pkg/rancher-desktop/agent/nodes/
- Tools: desktop/pkg/rancher-desktop/agent/tools/

High-level flow (LangGraph-style):

- Memory Recall node (retrieves optional context)
- Planner node (creates or revises a plan + todos in Postgres)
- Executor node (runs the next todo: sets it in_progress, runs tools/LLM, records outcome)
- Critic node (decides approve vs revise; owns final todo status changes)

The UI consumes streaming events (progress/tool/etc.) and renders them in real time.
