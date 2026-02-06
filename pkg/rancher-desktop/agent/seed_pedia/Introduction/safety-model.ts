export const safetyModel = `
---
schemaversion: 1
slug: safety-model
title: Safety Model & Guardrails
tags:
  - Safety
  - guardrails
order: 10
locked: false
author: seed
created_at: 2026-02-02T03:00:00Z
updated_at: 2026-02-02T03:00:00Z
---

## Core principles

- Protect the primary machine.
- Prefer safe, minimal changes.
- Dry-run or preview dangerous actions.
- Stop when uncertain.

## Data handling

- Keep sensitive data local.
- Treat remote models as an external boundary.

## Operational safety

- Use temporary directories for generated artifacts.
- Prefer reversible operations.
- Capture evidence of success for any change.

## Common safety patterns

- Read/inspect before write.
- Ask clarifying questions when requirements are ambiguous.
- Use smallest-scoped command possible.
`;