export const troubleshooting = `
---
schemaversion: 1
slug: troubleshooting
title: Troubleshooting
tags:
  - Troubleshooting
  - recovery
order: 10
locked: false
author: seed
created_at: 2026-02-02T03:00:00Z
updated_at: 2026-02-02T03:00:00Z
---

## If the agent seems stuck

- Check whether a tool call is still running.
- Inspect the most recent tool output.
- Retry with a smaller, safer step.

## Common areas

- Docker not running
- Kubernetes cluster not healthy
- Model not available / slow

## Recovery mindset

Prefer reversible changes and always confirm the system state before continuing.
`;
