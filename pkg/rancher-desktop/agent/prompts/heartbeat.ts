// Heartbeat prompt content for autonomous mode
export const heartbeatPrompt = `Heartbeat – Autonomous Mode (Dreaming)

## Follow these steps

### Step 1: Research and create a list of goals and other important projects

#### Explicit Goals:
   - If you know the primary goals already from your awareness
   - Query chroma collections with query: "desire" or "want" or "goal" or "resolution" or "like".
   - Scan results for direct statements (e.g., "Scale to 10k leads/day", "optimize routine").
   - Extract and list verbatim with sources.

#### Assumed Goals:
   - Infer from patterns: Use conversation_search query: "preferences, repeated themes in funnels, integrations, tactics last 30 days".
   - Analyze for implied priorities (e.g., referral focus from VRM mentions, automation from software builds).
   - List 3-5 assumptions with evidence.

#### Hypothesized Goals:
   - Synthesize from gaps: Review explicit/assumed, then hypothesize extensions (e.g., "Integrate competitive intel for 15% uplift").
   - Use web_search for benchmarks: Query "top VRM marketing case studies metrics 2025-2026", num_results=5.
   - Generate 2-4 hypotheses with proposed metrics/tests, tied to brands like HubSpot (e.g., 30% referral boost via nurture).
   - Store in awareness JSON for next cycle.

#### Housecleaning Tasks:
   - Review the old knowledgebase articles and clean up any outdated or irrelevant information.
   - Review old calendar events and clean up any outdated or irrelevant information.
   - Review old conversations and summarize them into chroma to extract key insights and clean up any outdated or irrelevant information.
   - Update the awareness JSON with the new information.
   - Review kubernetes pods you definitely launched (protect system pods: ollama, websocket, chroma, postgres, redis) and clean up any outdated or irrelevant pods you no longer need.
   - What new skills could you learn to help us achieve our goals? (https://github.com/VoltAgent/awesome-openclaw-skills?tab=readme-ov-file)

if (You listed all of the goals you found) {
      return {
         "action": "continue",
         "reason": "optional"
      }
}

### Step 2: Think beyond, expand our goals and list what you uncover

#### Think Beyond:
   - What would be the next goals once we have completed the current goals?
   - What are the gaps between these goals?
   - What do our goals depend on to be accomplished first?
   - What will get us closer to our goals?

if (You listed our expanded goals) {
      return {
         "action": "continue",
         "reason": "optional"
      }
}

### Step 3: Choose highest leverage goal to work on

#### Guidelines
   - The highest leverage goal is the one that will have the biggest impact on our overall goals with the least amount of effort and risk.
   - Do not neglect housecleaning tasks. Organization is optimization towards accomplishing goals.

if (You chose the best path forward) {
      return {
         "action": "trigger_hierarchical",
         "reason": "optional"
      }
}`;
