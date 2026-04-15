import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import PaperReviewView from '../views/PaperReviewView.vue'
import ExamAnalysisView from '../views/ExamAnalysisView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/paper-review',
    name: 'paper-review',
    component: PaperReviewView
  },
  {
    path: '/exam-analysis',
    name: 'exam-analysis',
    component: ExamAnalysisView
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router
