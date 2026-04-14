<template>
  <div class="app">
    <AppHeader />
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<script>
import AppHeader from '@/components/AppHeader.vue'

export default {
  components: { AppHeader }
}
</script>

<style>
.app {
  min-height: 100vh;
}

.main {
  min-height: calc(100vh - 60px);
}
</style>
