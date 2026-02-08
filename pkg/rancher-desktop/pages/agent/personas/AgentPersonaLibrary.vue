<template>
  <div class="w-full space-y-2">
    <div
      v-for="agent in visibleAgents"
      :key="agent.agentId"
      :class="`persona-profile-${agent.emotion}`"
      @click="registry.setActiveAgent(agent.agentId)"
    >
      <component
        :is="getPersonaComponent(agent.templateId)"
        :agent-id="agent.agentId"
        :agent-name="agent.agentName"
        :status="getAgentStatus(agent.agentId)"
        :total-tokens="getTotalTokens(agent.agentId)"
        :temperature="getTemperature(agent.agentId)"
        :input-cost="getInputCost(agent.agentId)"
        :output-cost="getOutputCost(agent.agentId)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import PersonaTerminal from './PersonaTerminal.vue';
import PersonaIndustrial from './PersonaIndustrial.vue';
import PersonaBioSynthetic from './PersonaBioSynthetic.vue';
import PersonaGlassCore from './PersonaGlassCore.vue';

import { computed } from 'vue';
import type { PersonaTemplateId } from '@pkg/agent';
import { getAgentPersonaRegistry } from '@pkg/agent';

const registry = getAgentPersonaRegistry();

const visibleAgents = computed(() => registry.state.agents.filter(a => a.isRunning));

function getAgentStatus(agentId: string): 'online' | 'idle' | 'busy' | 'offline' {
  const personaService = registry.getOrCreatePersonaService(agentId);
  // Return 'busy' when graph is running, otherwise use the agent's base status
  return personaService.graphRunning.value ? 'busy' : (registry.state.agents.find(a => a.agentId === agentId)?.status || 'offline');
}

function getTotalTokens(agentId: string): number {
  const personaService = registry.getOrCreatePersonaService(agentId);
  return personaService.state.totalTokensUsed;
}

function getTemperature(agentId: string): number {
  const personaService = registry.getOrCreatePersonaService(agentId);
  return personaService.state.temperature;
}

function getTotalCost(agentId: string): number {
  const personaService = registry.getOrCreatePersonaService(agentId);
  return personaService.state.totalCost;
}

function getInputCost(agentId: string): number {
  const personaService = registry.getOrCreatePersonaService(agentId);
  return personaService.state.totalInputCost;
}

function getOutputCost(agentId: string): number {
  const personaService = registry.getOrCreatePersonaService(agentId);
  return personaService.state.totalOutputCost;
}

function getPersonaComponent(templateId: PersonaTemplateId) {
  switch (templateId) {
    case 'terminal':
      return PersonaTerminal;
    case 'industrial':
      return PersonaIndustrial;
    case 'biosynthetic':
      return PersonaBioSynthetic;
    case 'glass-core':
      return PersonaGlassCore;
  }
}
</script>
