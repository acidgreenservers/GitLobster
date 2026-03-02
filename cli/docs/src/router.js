import { createRouter, createWebHistory } from 'vue-router'
import Home from './pages/Home.vue'
import Guide from './pages/Guide.vue'
import API from './pages/API.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/guide', component: Guide },
  { path: '/api', component: API }
]

export const router = createRouter({
  history: createWebHistory(),
  routes
})
