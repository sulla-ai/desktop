export const architectureOverview = `
---
schemaversion: 1
slug: architecture-overview
title: Architecture Overview
tags:
  - Architecture
  - overview
order: 10
locked: false
author: seed
created_at: 2026-02-02T03:00:00Z
updated_at: 2026-02-02T03:00:00Z
---

## Overview

This page describes how the Sulla Desktop UI, agent graph, tools, and persistence fit together.

## High-level flow

1. User message enters a **thread**.
2. The **agent graph** routes work through planner/executor nodes.
3. The executor chooses **tool calls**.
4. Tool outputs are appended back into the thread.
5. Results can be persisted into memory/knowledge.

## Storage

- **KnowledgeBase**: stored in Chroma collection \`knowledgebase_articles\`.
- **Other memory**: additional Chroma collections as applicable.

## Where to look in code

- \`agent/Graph.ts\`: graph orchestration.
- \`agent/nodes/*\`: planning/execution nodes.
- \`agent/tools/*\`: tool registry and implementations.
- \`agent/services/*\`: persistence, knowledge, chroma integration.
`;