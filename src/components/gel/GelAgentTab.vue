<template>
  <div class="tab-content agent-tab">

    <div
      class="session-overlay"
      :class="{ 'session-overlay--show': isSidebarOpen }"
      @click="isSidebarOpen = false"
    ></div>

    <aside class="session-sidebar" :class="{ 'session-sidebar--open': isSidebarOpen }">
      <div class="session-sidebar__header">
        <span class="session-sidebar__title">대화 목록</span>
        <button class="btn-new-chat" @click="newChat(); isSidebarOpen = false">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          새 대화
        </button>
      </div>
      <div class="session-list">
        <div v-if="sessionList.length === 0" class="session-empty">저장된 대화가 없습니다</div>
        <template v-for="(group, gi) in groupedSessions" :key="gi">
          <div class="session-group-label">{{ group.label }}</div>
          <div
            v-for="s in group.items"
            :key="s.sessionId"
            class="session-item"
            :class="{ 'session-item--active': s.sessionId === agentSessionId }"
            @click="selectSession(s.sessionId); isSidebarOpen = false"
          >
            <div class="session-item__body">
              <div class="session-item__title">{{ s.preview }}</div>
            </div>
            <button
              class="btn-delete-session"
              @click.stop="deleteSession(s.sessionId)"
              title="삭제"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </template>
      </div>
    </aside>

    <section class="agent-section">
      <div class="agent-header">
        <button class="btn-sidebar-toggle" @click="isSidebarOpen = !isSidebarOpen" title="대화 목록">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <h2 class="section-title" style="margin:0">AI 에이전트</h2>
      </div>
      <p class="section-desc">
        젤 이미지 첨부 시 M·10⁸~10¹·NTC 전체 레인을 분석합니다.
        ① <strong>mecA 이진 분류</strong>(양성/음성) ② 육안 미검출 저농도(10¹~10³) <strong>LOD 탐지 확률</strong> ③ 프라이머 다이머와 실제 밴드를 구분하는 <strong>노이즈 필터링</strong>을 중점 해석합니다.
      </p>

      <div
        class="chat-history"
        ref="chatHistory"
        :class="{ 'chat-history--drag': isDragOverChat }"
        @dragover.prevent="isDragOverChat = true"
        @dragleave.prevent="isDragOverChat = false"
        @drop.prevent="onChatDrop"
      >
        <div v-if="agentMessages.length === 0" class="chat-empty">
          이미지를 여기에 드래그하거나 아래 버튼으로 첨부하세요.<br>
          <span style="font-size:0.8rem;opacity:0.6">예: "이미지 분석해줘", "Ct값 28이면 양성인가요?"</span>
        </div>
        <div v-if="isDragOverChat" class="chat-drop-hint">이미지를 놓으세요</div>
        <div
          v-for="(msg, i) in agentMessages"
          :key="i"
          class="chat-msg"
          :class="msg.role === 'user' ? 'chat-msg--user' : 'chat-msg--agent'"
        >
          <div class="chat-msg__bubble">
            <img v-if="msg.imageUrl" :src="msg.imageUrl" class="chat-msg__image" alt="첨부 이미지" />
            <div v-if="msg.role === 'agent'" class="chat-msg__text" v-html="renderMarkdown(msg.text)"></div>
            <div v-else class="chat-msg__text">{{ msg.text }}</div>
          </div>
        </div>
        <div v-if="isAgentLoading" class="chat-msg chat-msg--agent">
          <div class="chat-msg__bubble chat-msg__bubble--loading">
            <span class="dot-pulse"></span>
            <div class="loading-status">
              <span class="loading-status__text">{{ loadingStatusText }}</span>
              <span class="loading-status__elapsed">{{ loadingElapsed }}s</span>
            </div>
          </div>
        </div>
      </div>

      <div class="chat-input-area">
        <div v-if="agentFile" class="agent-file-preview">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;opacity:0.7"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          <span class="agent-file-name">{{ agentFile.name }}</span>
          <button class="agent-file-remove" @click="agentFile = null" title="제거">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <textarea
          v-model="agentInput"
          class="chat-input"
          placeholder="질문을 입력하세요..."
          rows="1"
          @keydown.enter.exact.prevent="sendToAgent"
          @input="autoResize"
        ></textarea>
        <div class="chat-input-actions">
          <label class="attach-btn" title="이미지 첨부 (또는 드래그)">
            <input ref="agentFileInput" type="file" accept="image/*" style="display:none" @change="onAgentFileChange" />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
            <span class="attach-btn__label">이미지 첨부</span>
          </label>
          <button v-if="isAgentLoading" class="stop-btn" @click="stopAgent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2"/>
            </svg>
            <span>중지</span>
          </button>
          <button v-else class="send-btn" :disabled="!agentInput.trim() && !agentFile" @click="sendToAgent">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
            </svg>
            <span>전송</span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useGelAgent } from '@/composables/useGelAgent'

const {
  agentMessages, agentInput, agentFile, agentFileInput,
  isAgentLoading, agentSessionId, isDragOverChat,
  sessionList, isSidebarOpen, loadingElapsed, loadingStatusText,
  chatHistory, groupedSessions,
  loadSessionList, loadAgentHistory, selectSession,
  onChatDrop, onAgentFileChange, sendToAgent, stopAgent,
  newChat, deleteSession, autoResize,
  renderMarkdown
} = useGelAgent()

onMounted(() => {
  loadSessionList()
  loadAgentHistory()
})
</script>

<style scoped>
@import '@/assets/css/gel/shared.css';
@import '@/assets/css/gel/agent.css';
</style>
