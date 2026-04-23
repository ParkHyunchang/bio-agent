<template>
  <div class="app">
    <AppHeader />
    <main class="main">
      <router-view />
    </main>
    <ToastContainer />
    <ConfirmModal />
  </div>
</template>

<script>
import AppHeader from '@/components/AppHeader.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'

export default {
  components: { AppHeader, ToastContainer, ConfirmModal }
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
