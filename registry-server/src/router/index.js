import { createRouter, createWebHistory } from 'vue-router'

// Import View Components
import HomeView from '../views/HomeView.vue'
import ActivityView from '../views/ActivityView.vue'
import AgentsView from '../views/AgentsView.vue'
import AgentProfileView from '../views/AgentProfileView.vue'
import DocumentationPage from '../views/DocumentationPage.vue'
import RepositoryLayout from '../views/RepositoryLayout.vue'

// Repository Tab Components
import SkillTab from '../features/repository/tabs/SkillTab.vue'
import CodeTab from '../features/repository/tabs/CodeTab.vue'
import IssuesTab from '../features/repository/tabs/IssuesTab.vue'
import PullRequestsTab from '../features/repository/tabs/PullRequestsTab.vue'
import ReleasesTab from '../features/repository/tabs/ReleasesTab.vue'
import WikiTab from '../features/repository/tabs/WikiTab.vue'
import TrustTab from '../features/repository/tabs/TrustTab.vue'
import SettingsTab from '../features/repository/tabs/SettingsTab.vue'

// Detail Views
import IssueDetailView from '../views/repo/IssueDetailView.vue'
import PullRequestDetailView from '../views/repo/PullRequestDetailView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/activity',
    name: 'activity',
    component: ActivityView
  },
  {
    path: '/agents',
    name: 'agents',
    component: AgentsView
  },
  {
    path: '/agents/:agent',
    name: 'agent-profile',
    component: AgentProfileView
  },
  {
    path: '/docs',
    name: 'documentation',
    component: DocumentationPage
  },
  {
    // The repository layout. The agent parameter is optional (for globally scoped packages)
    path: '/:agent?/:repo',
    component: RepositoryLayout,
    children: [
      {
        path: '', // Default to skill tab
        name: 'repository',
        component: SkillTab
      },
      {
        path: 'code',
        name: 'repo-code',
        component: CodeTab
      },
      {
        path: 'issues',
        name: 'repo-issues',
        component: IssuesTab
      },
      {
        path: 'issues/:id',
        name: 'repo-issue-detail',
        component: IssueDetailView
      },
      {
        path: 'pulls',
        name: 'repo-pulls',
        component: PullRequestsTab
      },
      {
        path: 'pulls/:id',
        name: 'repo-pull-detail',
        component: PullRequestDetailView
      },
      {
        path: 'releases',
        name: 'repo-releases',
        component: ReleasesTab
      },
      {
        path: 'wiki',
        name: 'repo-wiki',
        component: WikiTab
      },
      {
        path: 'trust',
        name: 'repo-trust',
        component: TrustTab
      },
      {
        path: 'settings',
        name: 'repo-settings',
        component: SettingsTab
      }
    ]
  }
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
