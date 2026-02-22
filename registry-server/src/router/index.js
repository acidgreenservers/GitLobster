import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '../views/HomeView.vue'
import ActivityView from '../views/ActivityView.vue'
import AgentsView from '../views/AgentsView.vue'
import AgentProfileView from '../views/AgentProfileView.vue'
import RepositoryLayout from '../views/RepositoryLayout.vue'
import DocumentationPage from '../views/DocumentationPage.vue'
import FullDocsView from '../features/docs/FullDocsView.vue'
import PrivacyPolicy from '../features/pages/PrivacyPolicy.vue'
import TermsOfService from '../features/pages/TermsOfService.vue'
import StatusPage from '../features/pages/StatusPage.vue'

// Repo Tabs
import CodeTab from '../features/repository/tabs/CodeTab.vue'
import IssuesTab from '../features/repository/tabs/IssuesTab.vue'
import PullRequestsTab from '../features/repository/tabs/PullRequestsTab.vue'
import WikiTab from '../features/repository/tabs/WikiTab.vue'
import SkillTab from '../features/repository/tabs/SkillTab.vue'
import TrustTab from '../features/repository/tabs/TrustTab.vue'
import ReleasesTab from '../features/repository/tabs/ReleasesTab.vue'
import SettingsTab from '../features/repository/tabs/SettingsTab.vue'

// Detail Views
import IssueDetailView from '../views/repo/IssueDetailView.vue'
import PullRequestDetailView from '../views/repo/PullRequestDetailView.vue'

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/activity', name: 'activity', component: ActivityView },
  { path: '/agents', name: 'agents', component: AgentsView },
  { path: '/docs', name: 'docs', component: DocumentationPage },
  { path: '/docs/full', name: 'full-docs', component: FullDocsView },
  { path: '/privacy', name: 'privacy', component: PrivacyPolicy },
  { path: '/terms', name: 'terms', component: TermsOfService },
  { path: '/status', name: 'status', component: StatusPage },

  // Dynamic Routes
  { path: '/:agent', name: 'agent-profile', component: AgentProfileView },
  {
    path: '/:agent/:repo',
    component: RepositoryLayout,
    children: [
        { path: '', name: 'repo-root', redirect: { name: 'repo-code' } },
        { path: 'code', name: 'repo-code', component: CodeTab },
        { path: 'issues', name: 'repo-issues', component: IssuesTab },
        { path: 'issues/:id', name: 'issue-detail', component: IssueDetailView },
        { path: 'pulls', name: 'repo-pulls', component: PullRequestsTab },
        { path: 'pulls/:id', name: 'pull-detail', component: PullRequestDetailView },
        { path: 'wiki', name: 'repo-wiki', component: WikiTab },
        { path: 'skill', name: 'repo-skill', component: SkillTab },
        { path: 'trust', name: 'repo-trust', component: TrustTab },
        { path: 'releases', name: 'repo-releases', component: ReleasesTab },
        { path: 'settings', name: 'repo-settings', component: SettingsTab }
    ]
  },

  // Catch-all
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

export default router
