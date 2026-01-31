/**
 * This is the entry point for the Agent window.
 */

import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';

import './agent-tailwind.css';

import AgentRouter from '../pages/AgentRouter.vue';
import Agent from '../pages/Agent.vue';
import AgentCalendar from '../pages/AgentCalendar.vue';

const router = createRouter({
  history: createWebHashHistory(),
  routes:  [
    { path: '/', redirect: '/Chat' },
    { path: '/Chat', component: Agent, name: 'AgentChat' },
    { path: '/Calendar', component: AgentCalendar, name: 'AgentCalendar' },
  ],
});

const app = createApp(AgentRouter);

app.use(router);

app.mount('#app');
