export const dockerBasics = `
---
schemaversion: 1
slug: docker-basics
title: Docker in Sulla
tags:
  - Docker
  - basics
order: 10
locked: false
author: seed
created_at: 2026-02-02T03:00:00Z
updated_at: 2026-02-02T03:00:00Z
---

## Why Docker

Docker provides repeatable packaging and isolated execution environments, which helps Sulla run workloads consistently.

## What to know

- Images vs containers
- Volumes for persistence
- Networks for connectivity

## Common tasks

- Verify Docker is running
- List containers/images
- Stop/remove containers
- Reclaim disk space safely

## How it ties into Sulla

Sulla may rely on containerized components and/or images to support its workflows.
`;