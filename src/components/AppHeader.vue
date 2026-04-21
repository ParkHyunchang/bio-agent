<template>
  <header class="app-header">
    <router-link to="/" class="logo">
      <span class="logo__icon">⬡</span>
      Bio Agent
    </router-link>
    <nav class="nav" :class="{ 'nav--open': mobileMenuOpen }">
      <router-link to="/" class="nav__link" :class="{ 'nav__link--active': $route.path === '/' }" @click="mobileMenuOpen = false">
        Home
      </router-link>
      <router-link to="/paper-review" class="nav__link" :class="{ 'nav__link--active': $route.path === '/paper-review' }" @click="mobileMenuOpen = false">
        논문 리뷰
      </router-link>
      <router-link to="/exam-analysis" class="nav__link" :class="{ 'nav__link--active': $route.path === '/exam-analysis' }" @click="mobileMenuOpen = false">
        검사 분석
      </router-link>
      <router-link to="/gel-analysis" class="nav__link" :class="{ 'nav__link--active': $route.path === '/gel-analysis' }" @click="mobileMenuOpen = false">
        젤 분석
      </router-link>
    </nav>
    <button type="button" class="hamburger" :class="{ 'hamburger--open': mobileMenuOpen }" @click="mobileMenuOpen = !mobileMenuOpen">
      <span></span><span></span><span></span>
    </button>
  </header>
</template>

<script setup>
import { ref } from 'vue'

const mobileMenuOpen = ref(false)
</script>

<style scoped>
@import '@/assets/css/components/header.css';
</style>
