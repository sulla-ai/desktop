/**
 * This is the entry point for the Agent window.
 */

import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';

import './agent-tailwind.css';

import AgentRouter from '../pages/AgentRouter.vue';
import Agent from '../pages/Agent.vue';
import AgentCalendar from '../pages/AgentCalendar.vue';
import AgentKnowledgeBase from '../pages/AgentKnowledgeBase.vue';
import AgentSkills from '../pages/AgentSkills.vue';
import AgentSkillDetail from '../pages/AgentSkillDetail.vue';

const router = createRouter({
  history: createWebHashHistory(),
  routes:  [
    { path: '/', redirect: '/Chat' },
    { path: '/Chat', component: Agent, name: 'AgentChat' },
    { path: '/Calendar', component: AgentCalendar, name: 'AgentCalendar' },
    { path: '/KnowledgeBase', component: AgentKnowledgeBase, name: 'AgentKnowledgeBase' },
    { path: '/Skills', component: AgentSkills, name: 'AgentSkills' },
    { path: '/Skills/:id', component: AgentSkillDetail, name: 'AgentSkillDetail' },
  ],
});

const app = createApp(AgentRouter);

app.use(router);

app.mount('#app');
