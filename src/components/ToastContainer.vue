<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite">
      <TransitionGroup name="toast" tag="div">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast"
          :class="`toast--${t.type}`"
          @click="remove(t.id)"
        >
          <span class="toast__icon">{{ ICONS[t.type] }}</span>
          <span class="toast__msg">{{ t.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useToast } from '@/composables/useToast'

const { toasts, remove } = useToast()
const ICONS = { success: '✓', error: '✕', info: 'ℹ', warn: '⚠' }
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 1.25rem;
  right: 1.25rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.7rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  line-height: 1.4;
  max-width: 360px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  cursor: pointer;
  pointer-events: all;
  backdrop-filter: blur(4px);
}

.toast--success { background: rgba(76,175,80,0.95);  color: #fff; }
.toast--error   { background: rgba(229,57,53,0.95);   color: #fff; }
.toast--info    { background: rgba(33,150,243,0.95);  color: #fff; }
.toast--warn    { background: rgba(255,152,0,0.95);   color: #fff; }

.toast__icon { font-size: 1rem; flex-shrink: 0; margin-top: 0.05rem; }
.toast__msg  { flex: 1; word-break: break-word; }

.toast-enter-active,
.toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from   { opacity: 0; transform: translateX(20px); }
.toast-leave-to     { opacity: 0; transform: translateX(20px); }
</style>
