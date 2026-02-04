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
        :status="agent.status"
        :tokens-per-second="agent.tokensPerSecond"
        :temperature="agent.temperature"
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
