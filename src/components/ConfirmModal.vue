<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="pending" class="modal-overlay" @click.self="respond(false)">
        <div class="modal-dialog" role="dialog" aria-modal="true">
          <p class="modal-message">{{ pending.message }}</p>
          <div class="modal-actions">
            <button class="btn-modal-cancel" @click="respond(false)">취소</button>
            <button class="btn-modal-confirm" @click="respond(true)">확인</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useConfirm } from '@/composables/useConfirm'

const { pending, respond } = useConfirm()
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-dialog {
  background: var(--surface, #fff);
  border: 1px solid var(--card-border, #e0e0e0);
  border-radius: 12px;
  padding: 1.5rem 1.75rem;
  min-width: 280px;
  max-width: 380px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}

.modal-message {
  font-size: 0.95rem;
  line-height: 1.55;
  margin: 0 0 1.25rem;
  color: var(--text-primary, #111);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.btn-modal-cancel {
  padding: 0.45rem 1rem;
  background: transparent;
  border: 1px solid var(--card-border, #ccc);
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  color: var(--text-secondary, #666);
}

.btn-modal-confirm {
  padding: 0.45rem 1.1rem;
  background: #e53935;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  font-weight: 500;
}

.btn-modal-cancel:hover  { background: rgba(0,0,0,0.04); }
.btn-modal-confirm:hover { background: #c62828; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.18s ease; }
.fade-enter-from,  .fade-leave-to      { opacity: 0; }
</style>
