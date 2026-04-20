<template>
  <div class="gel-analysis">

    <!-- 탭 헤더 -->
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'train' }"
        @click="activeTab = 'train'"
      >
        훈련 데이터 관리
      </button>
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'predict' }"
        @click="activeTab = 'predict'"
      >
        Ct값 예측
      </button>
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'agent' }"
        @click="activeTab = 'agent'"
      >
        AI 에이전트
      </button>

      <!-- 모델 상태 배지 -->
      <div class="model-badge" :class="modelStatus.trained ? 'model-badge--ok' : 'model-badge--none'">
        <span v-if="modelStatus.trained">
          모델 학습됨 · R² {{ modelStatus.cv_r2_mean }} · {{ modelStatus.sample_count }}개
        </span>
        <span v-else>모델 미학습</span>
      </div>
    </div>

    <!-- ────────────── 탭 1: 훈련 데이터 관리 ────────────── -->
    <div v-if="activeTab === 'train'" class="tab-content">

      <!-- 업로드 폼 -->
      <section class="upload-section">
        <h2 class="section-title">훈련 데이터 등록</h2>
        <p class="section-desc">PCR 젤 이미지와 외부 기관에서 측정한 qPCR Ct값을 함께 업로드합니다.</p>

        <div class="upload-row">
          <!-- 드래그&드롭 영역 -->
          <div
            class="upload-area"
            :class="{ 'upload-area--drag': isDragging }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onDrop"
          >
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              class="upload-area__input"
              @change="onFileChange"
            />
            <div class="upload-area__inner" @click="$refs.fileInput.click()">
              <div class="upload-area__icon">🧫</div>
              <p class="upload-area__text">젤 이미지를 끌어다 놓거나 클릭</p>
              <p class="upload-area__sub">JPG, PNG · 최대 20MB</p>
            </div>
          </div>

          <!-- Ct값 입력 + 업로드 버튼 -->
          <div class="ct-input-group">
            <label class="input-label">실측 Ct값 (qPCR)</label>
            <input
              v-model.number="ctValue"
              type="number"
              step="0.01"
              min="0"
              max="50"
              placeholder="예: 24.35"
              class="ct-input"
            />
            <p v-if="selectedFile" class="file-chip">
              <span>{{ selectedFile.name }}</span>
              <button class="file-chip__remove" @click="clearFile">×</button>
            </p>
            <button
              class="btn-primary"
              :disabled="!selectedFile || ctValue === null || isUploading"
              @click="uploadTrainingData"
            >
              <span v-if="isUploading" class="spinner"></span>
              <span v-else>업로드</span>
            </button>
          </div>
        </div>

        <!-- 업로드 결과 -->
        <div v-if="uploadResult" class="result-box result-box--success">
          <strong>업로드 완료:</strong> {{ uploadResult.fileName }}
          — 밝기 {{ fmt(uploadResult.bandIntensity) }}, 면적 {{ fmt(uploadResult.bandArea) }},
          상대강도 {{ fmt(uploadResult.relativeIntensity) }}
          <span v-if="uploadResult.warning" class="warn-text"> ⚠ {{ uploadResult.warning }}</span>
        </div>
      </section>

      <!-- 모델 학습 -->
      <section class="train-section">
        <div class="train-header">
          <h2 class="section-title">모델 재학습</h2>
          <button
            class="btn-secondary"
            :disabled="records.length < 3 || isTraining"
            @click="trainModel"
          >
            <span v-if="isTraining" class="spinner"></span>
            <span v-else>학습 실행 ({{ records.length }}개)</span>
          </button>
        </div>
        <p class="section-desc">저장된 훈련 데이터 전체를 사용해 회귀 모델을 재학습합니다. 최소 3개 이상 필요.</p>

        <div v-if="trainResult" class="result-box result-box--info">
          <strong>학습 완료</strong> · 모델: {{ trainResult.model_type }}
          · 훈련 R²: {{ trainResult.train_r2 }}
          · CV R²: {{ trainResult.cv_r2_mean }} ± {{ trainResult.cv_r2_std }}
          · RMSE: {{ trainResult.train_rmse }} Ct
          · 샘플: {{ trainResult.sample_count }}개
        </div>
      </section>

      <!-- 훈련 데이터 목록 -->
      <section class="records-section">
        <h2 class="section-title">훈련 데이터 목록</h2>

        <div v-if="isLoadingRecords" class="list-loading">
          <div class="spinner"></div>
        </div>

        <div v-else-if="records.length === 0" class="list-empty">
          등록된 훈련 데이터가 없습니다.
        </div>

        <div v-else class="records-table-wrap">
          <table class="records-table">
            <thead>
              <tr>
                <th>파일명</th>
                <th>Ct값</th>
                <th>밝기</th>
                <th>면적</th>
                <th>상대강도</th>
                <th>등록일</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in records" :key="r.id" :class="{ 'row--warn': r.warning }">
                <td class="col-name">{{ r.fileName }}</td>
                <td class="col-ct">{{ r.ctValue }}</td>
                <td>{{ fmt(r.bandIntensity) }}</td>
                <td>{{ fmt(r.bandArea) }}</td>
                <td>{{ fmt(r.relativeIntensity) }}</td>
                <td class="col-date">{{ formatDate(r.createdAt) }}</td>
                <td>
                  <button class="btn-delete" @click="deleteRecord(r.id)">삭제</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- ────────────── 탭 2: Ct값 예측 ────────────── -->
    <div v-if="activeTab === 'predict'" class="tab-content">
      <section class="predict-section">
        <h2 class="section-title">새 이미지로 Ct값 예측</h2>
        <p class="section-desc">PCR 젤 이미지를 업로드하면 학습된 모델이 qPCR Ct값을 예측합니다.</p>

        <div v-if="!modelStatus.trained" class="result-box result-box--warn">
          모델이 아직 학습되지 않았습니다. 훈련 데이터 탭에서 데이터를 등록하고 학습을 실행하세요.
        </div>

        <div class="upload-row">
          <div
            class="upload-area"
            :class="{ 'upload-area--drag': isPredictDragging }"
            @dragover.prevent="isPredictDragging = true"
            @dragleave.prevent="isPredictDragging = false"
            @drop.prevent="onPredictDrop"
          >
            <input
              ref="predictFileInput"
              type="file"
              accept="image/*"
              class="upload-area__input"
              @change="onPredictFileChange"
            />
            <div class="upload-area__inner" @click="$refs.predictFileInput.click()">
              <div class="upload-area__icon">🔬</div>
              <p class="upload-area__text">예측할 젤 이미지 선택</p>
              <p class="upload-area__sub">JPG, PNG · 최대 20MB</p>
            </div>
          </div>

          <div class="ct-input-group">
            <p v-if="predictFile" class="file-chip">
              <span>{{ predictFile.name }}</span>
              <button class="file-chip__remove" @click="predictFile = null">×</button>
            </p>
            <button
              class="btn-primary"
              :disabled="!predictFile || isPredicting || !modelStatus.trained"
              @click="predictCt"
            >
              <span v-if="isPredicting" class="spinner"></span>
              <span v-else>예측하기</span>
            </button>
          </div>
        </div>

        <!-- 예측 결과 -->
        <div v-if="predictResult" class="predict-result">
          <div class="predict-result__ct">
            <span class="predict-result__label">예측 Ct값</span>
            <span class="predict-result__value">{{ predictResult.predictedCt }}</span>
          </div>
          <div class="predict-result__meta">
            <span>모델 R²: {{ predictResult.modelR2 }}</span>
            <span>RMSE: ±{{ predictResult.modelRmse }} Ct</span>
          </div>
          <div v-if="predictResult.features" class="predict-result__features">
            <div class="feature-chip">밝기 {{ fmt(predictResult.features.band_intensity) }}</div>
            <div class="feature-chip">면적 {{ fmt(predictResult.features.band_area) }}</div>
            <div class="feature-chip">상대강도 {{ fmt(predictResult.features.relative_intensity) }}</div>
            <div class="feature-chip">너비 {{ fmt(predictResult.features.band_width) }}</div>
          </div>
          <div v-if="predictResult.features?.warning" class="warn-text">
            ⚠ {{ predictResult.features.warning }}
          </div>
        </div>
      </section>
    </div>

    <!-- ────────────── 탭 3: AI 에이전트 ────────────── -->
    <div v-if="activeTab === 'agent'" class="tab-content agent-tab">

      <!-- 모바일 오버레이 -->
      <div
        class="session-overlay"
        :class="{ 'session-overlay--show': isSidebarOpen }"
        @click="isSidebarOpen = false"
      ></div>

      <!-- 세션 사이드바 -->
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

      <!-- 채팅 영역 -->
      <section class="agent-section">
        <div class="agent-header">
          <!-- 모바일 전용 햄버거 -->
          <button class="btn-sidebar-toggle" @click="isSidebarOpen = !isSidebarOpen" title="대화 목록">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <h2 class="section-title" style="margin:0">AI 에이전트</h2>
        </div>
        <p class="section-desc">
          PCR 젤 이미지를 첨부하거나 질문을 입력하면 AI 에이전트가 분석하고 해석해드립니다.
        </p>

        <!-- 대화 기록 -->
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
            </div>
          </div>
        </div>

        <!-- 입력 영역 -->
        <div class="chat-input-area">
          <label class="attach-btn" title="이미지 첨부">
            <input ref="agentFileInput" type="file" accept="image/*" style="display:none" @change="onAgentFileChange" />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
          </label>
          <div class="chat-input-wrap">
            <div v-if="agentFile" class="agent-file-chip">
              <span>{{ agentFile.name }}</span>
              <button @click="agentFile = null">×</button>
            </div>
            <textarea
              v-model="agentInput"
              class="chat-input"
              placeholder="질문을 입력하세요..."
              rows="1"
              @keydown.enter.exact.prevent="sendToAgent"
              @input="autoResize"
            ></textarea>
          </div>
          <button class="send-btn" :disabled="(!agentInput.trim() && !agentFile) || isAgentLoading" @click="sendToAgent">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
            </svg>
          </button>
        </div>
      </section>
    </div>

  </div>
</template>

<script>
import api from '@/axios'

export default {
  name: 'GelAnalysisView',
  data() {
    return {
      activeTab: 'train',

      // 훈련 데이터 업로드
      selectedFile: null,
      ctValue: null,
      isDragging: false,
      isUploading: false,
      uploadResult: null,

      // 훈련
      isTraining: false,
      trainResult: null,

      // 목록
      records: [],
      isLoadingRecords: false,

      // 예측
      predictFile: null,
      isPredictDragging: false,
      isPredicting: false,
      predictResult: null,

      // 모델 상태
      modelStatus: { trained: false },

      // AI 에이전트
      agentMessages: [],
      agentInput: '',
      agentFile: null,
      isAgentLoading: false,
      agentSessionId: null,
      isDragOverChat: false,
      sessionList: [],
      isSidebarOpen: false
    }
  },
  mounted() {
    this.loadRecords()
    this.loadModelStatus()
    this.loadAgentHistory()
    this.loadSessionList()
  },
  computed: {
    groupedSessions() {
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const startOfYesterday = new Date(startOfToday - 86400000)
      const startOf7Days = new Date(startOfToday - 6 * 86400000)
      const startOf30Days = new Date(startOfToday - 29 * 86400000)

      const groups = [
        { label: '오늘', items: [] },
        { label: '어제', items: [] },
        { label: '이전 7일', items: [] },
        { label: '이전 30일', items: [] },
        { label: '더 오래된 대화', items: [] },
      ]
      for (const s of this.sessionList) {
        const d = new Date(s.updatedAt)
        if (d >= startOfToday)         groups[0].items.push(s)
        else if (d >= startOfYesterday) groups[1].items.push(s)
        else if (d >= startOf7Days)     groups[2].items.push(s)
        else if (d >= startOf30Days)    groups[3].items.push(s)
        else                            groups[4].items.push(s)
      }
      return groups.filter(g => g.items.length > 0)
    }
  },
  methods: {
    // ── 파일 선택 ────────────────────────────────────────────────
    onFileChange(e) {
      this.selectedFile = e.target.files[0] || null
    },
    onDrop(e) {
      this.isDragging = false
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) this.selectedFile = file
    },
    clearFile() {
      this.selectedFile = null
      this.$refs.fileInput.value = ''
    },

    onPredictFileChange(e) {
      this.predictFile = e.target.files[0] || null
    },
    onPredictDrop(e) {
      this.isPredictDragging = false
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) this.predictFile = file
    },

    // ── 훈련 데이터 업로드 ──────────────────────────────────────
    async uploadTrainingData() {
      if (!this.selectedFile || this.ctValue === null) return
      this.isUploading = true
      this.uploadResult = null
      try {
        const form = new FormData()
        form.append('file', this.selectedFile)
        form.append('ctValue', this.ctValue)
        const { data } = await api.post('/api/gel/upload', form)
        this.uploadResult = data
        this.clearFile()
        this.ctValue = null
        await this.loadRecords()
      } catch (e) {
        alert('업로드 실패: ' + (e.response?.data || e.message))
      } finally {
        this.isUploading = false
      }
    },

    // ── 목록 로드 / 삭제 ────────────────────────────────────────
    async loadRecords() {
      this.isLoadingRecords = true
      try {
        const { data } = await api.get('/api/gel/records')
        this.records = data
      } catch (e) {
        console.error('목록 로드 실패', e)
      } finally {
        this.isLoadingRecords = false
      }
    },
    async deleteRecord(id) {
      if (!confirm('이 훈련 데이터를 삭제하시겠습니까?')) return
      try {
        await api.delete(`/api/gel/records/${id}`)
        this.records = this.records.filter(r => r.id !== id)
      } catch (e) {
        alert('삭제 실패: ' + (e.response?.data || e.message))
      }
    },

    // ── 모델 학습 ───────────────────────────────────────────────
    async trainModel() {
      this.isTraining = true
      this.trainResult = null
      try {
        const { data } = await api.post('/api/gel/train')
        this.trainResult = data
        await this.loadModelStatus()
      } catch (e) {
        alert('학습 실패: ' + (e.response?.data?.error || e.message))
      } finally {
        this.isTraining = false
      }
    },

    // ── Ct값 예측 ───────────────────────────────────────────────
    async predictCt() {
      if (!this.predictFile) return
      this.isPredicting = true
      this.predictResult = null
      try {
        const form = new FormData()
        form.append('file', this.predictFile)
        const { data } = await api.post('/api/gel/predict', form)
        this.predictResult = data
      } catch (e) {
        alert('예측 실패: ' + (e.response?.data || e.message))
      } finally {
        this.isPredicting = false
      }
    },

    // ── 모델 상태 ───────────────────────────────────────────────
    async loadModelStatus() {
      try {
        const { data } = await api.get('/api/gel/model/status')
        this.modelStatus = data
      } catch {
        this.modelStatus = { trained: false }
      }
    },

    // ── AI 에이전트 ─────────────────────────────────────────────
    async loadSessionList() {
      try {
        const { data } = await api.get('/api/agent/sessions')
        this.sessionList = data
      } catch { /* 무시 */ }
    },
    async selectSession(sessionId) {
      if (sessionId === this.agentSessionId) return
      this.agentSessionId = sessionId
      localStorage.setItem('agentSessionId', sessionId)
      this.agentMessages = []
      try {
        const { data } = await api.get(`/api/agent/session/${sessionId}/history`)
        if (Array.isArray(data)) {
          this.agentMessages = data.map(m => ({ role: m.role, text: m.text, hadImage: !!m.hadImage }))
        }
      } catch { /* 무시 */ }
      this.$nextTick(() => this.scrollChat())
    },
    formatSessionDate(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      const now = new Date()
      const diff = now - d
      if (diff < 60000) return '방금'
      if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`
      return `${d.getMonth() + 1}/${d.getDate()}`
    },
    async loadAgentHistory() {
      try {
        const sid = localStorage.getItem('agentSessionId')
        if (!sid) return
        this.agentSessionId = sid
        const { data } = await api.get(`/api/agent/session/${sid}/history`)
        if (Array.isArray(data) && data.length) {
          this.agentMessages = data.map(m => ({ role: m.role, text: m.text, hadImage: !!m.hadImage }))
          this.$nextTick(() => this.scrollChat())
        }
      } catch { /* 무시 */ }
    },
    onChatDrop(e) {
      this.isDragOverChat = false
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) {
        this.agentFile = file
      }
    },
    onAgentFileChange(e) {
      this.agentFile = e.target.files[0] || null
      this.$refs.agentFileInput.value = ''
    },
    async sendToAgent() {
      const text = this.agentInput.trim()
      if (!text && !this.agentFile) return
      if (this.isAgentLoading) return

      const file = this.agentFile
      const imageUrl = file ? URL.createObjectURL(file) : null

      // 사용자 메시지 추가
      this.agentMessages.push({ role: 'user', text: text || '(이미지 분석 요청)', imageUrl })
      this.agentInput = ''
      this.agentFile = null
      this.isAgentLoading = true
      this.$nextTick(() => this.scrollChat())

      try {
        const form = new FormData()
        form.append('message', text || '이 이미지를 분석해주세요.')
        if (file) form.append('file', file)
        if (this.agentSessionId) form.append('sessionId', this.agentSessionId)

        const { data } = await api.post('/api/agent/chat', form)
        this.agentSessionId = data.sessionId
        this.agentMessages.push({ role: 'agent', text: data.message })
      } catch (e) {
        this.agentMessages.push({
          role: 'agent',
          text: '오류가 발생했습니다: ' + (e.response?.data?.message || e.message)
        })
      } finally {
        this.isAgentLoading = false
        if (this.agentSessionId) localStorage.setItem('agentSessionId', this.agentSessionId)
        this.$nextTick(() => this.scrollChat())
        this.loadSessionList()
      }
    },
    newChat() {
      this.agentSessionId = null
      this.agentMessages = []
      this.agentInput = ''
      this.agentFile = null
      localStorage.removeItem('agentSessionId')
    },
    async deleteSession(sessionId) {
      await api.delete(`/api/agent/session/${sessionId}`).catch(() => {})
      if (this.agentSessionId === sessionId) {
        this.agentSessionId = null
        this.agentMessages = []
        localStorage.removeItem('agentSessionId')
      }
      this.loadSessionList()
    },
    scrollChat() {
      const el = this.$refs.chatHistory
      if (el) el.scrollTop = el.scrollHeight
    },
    autoResize(e) {
      const el = e.target
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    },
    renderMarkdown(text) {
      let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      // ## 헤딩
      html = html.replace(/^## (.+)$/gm, '<strong class="md-heading">$1</strong>')
      // **bold**
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // 줄바꿈
      html = html.replace(/\n/g, '<br>')
      return html
    },

    // ── 유틸 ────────────────────────────────────────────────────
    fmt(v) {
      if (v === null || v === undefined) return '—'
      return Number(v).toFixed(2)
    },
    formatDate(dt) {
      if (!dt) return ''
      return new Date(dt).toLocaleDateString('ko-KR', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      })
    }
  }
}
</script>

<style scoped>
.gel-analysis {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

/* ── 탭 바 ─────────────────────────────────────────────────── */
.tab-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--card-border);
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 0.6rem 1.25rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-size: 0.95rem;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}

.tab-btn--active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.model-badge {
  margin-left: auto;
  font-size: 0.8rem;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--card-border);
}

.model-badge--ok  { color: #4caf50; border-color: #4caf50; }
.model-badge--none { color: var(--text-secondary); }

/* ── 섹션 공통 ─────────────────────────────────────────────── */
.tab-content { display: flex; flex-direction: column; gap: 2rem; }

.section-title { font-size: 1rem; font-weight: 600; margin: 0 0 0.25rem; }
.section-desc  { font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 1rem; }

/* ── 업로드 영역 ───────────────────────────────────────────── */
.upload-row {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.upload-area {
  flex: 1;
  min-width: 220px;
  border: 2px dashed var(--card-border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s;
  position: relative;
}

.upload-area--drag { border-color: var(--accent); }
.upload-area:hover  { border-color: var(--accent); }

.upload-area__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}

.upload-area__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  gap: 0.4rem;
}

.upload-area__icon { font-size: 2rem; }
.upload-area__text { font-size: 0.9rem; margin: 0; }
.upload-area__sub  { font-size: 0.75rem; color: var(--text-secondary); margin: 0; }

/* ── Ct 입력 그룹 ──────────────────────────────────────────── */
.ct-input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 180px;
}

.input-label { font-size: 0.85rem; color: var(--text-secondary); }

.ct-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 1rem;
  width: 100%;
}

.ct-input:focus { outline: none; border-color: var(--accent); }

/* ── 파일 칩 ───────────────────────────────────────────────── */
.file-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin: 0;
  overflow: hidden;
}

.file-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-chip__remove {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
}

/* ── 버튼 ──────────────────────────────────────────────────── */
.btn-primary {
  padding: 0.55rem 1.25rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  padding: 0.45rem 1rem;
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-delete {
  padding: 0.25rem 0.6rem;
  background: transparent;
  border: 1px solid #e57373;
  color: #e57373;
  border-radius: 4px;
  font-size: 0.78rem;
  cursor: pointer;
}

/* ── 결과 박스 ─────────────────────────────────────────────── */
.result-box {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  line-height: 1.6;
  margin-top: 0.75rem;
}

.result-box--success { background: rgba(76, 175, 80, 0.1); border: 1px solid #4caf50; }
.result-box--info    { background: rgba(33, 150, 243, 0.1); border: 1px solid #2196f3; }
.result-box--warn    { background: rgba(255, 152, 0, 0.1);  border: 1px solid #ff9800; }

.warn-text { color: #ff9800; font-size: 0.82rem; }

/* ── 학습 헤더 ─────────────────────────────────────────────── */
.train-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.25rem;
}

/* ── 테이블 ────────────────────────────────────────────────── */
.records-table-wrap { overflow-x: auto; }

.records-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.records-table th,
.records-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--card-border);
  text-align: left;
  white-space: nowrap;
}

.records-table th { color: var(--text-secondary); font-weight: 500; }

.col-name { max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
.col-ct   { font-weight: 600; color: var(--accent); }
.col-date { color: var(--text-secondary); }

.row--warn td { background: rgba(255, 152, 0, 0.05); }

/* ── 예측 결과 ─────────────────────────────────────────────── */
.predict-result {
  margin-top: 1.5rem;
  padding: 1.5rem;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.predict-result__ct {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.predict-result__label { font-size: 0.85rem; color: var(--text-secondary); }
.predict-result__value { font-size: 2.4rem; font-weight: 700; color: var(--accent); }

.predict-result__meta {
  display: flex;
  gap: 1.5rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.predict-result__features {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.feature-chip {
  padding: 0.2rem 0.6rem;
  background: var(--surface);
  border: 1px solid var(--card-border);
  border-radius: 999px;
  font-size: 0.78rem;
  color: var(--text-secondary);
}

/* ── 로딩 / 빈 상태 ────────────────────────────────────────── */
.list-loading, .list-empty {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

/* ── 스피너 ────────────────────────────────────────────────── */
.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── 반응형 ────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .upload-row { flex-direction: column; }
  .ct-input-group { min-width: unset; }
  .predict-result__ct { flex-direction: column; gap: 0.25rem; }
}

/* ── AI 에이전트 탭 ──────────────────────────────────────────── */
.agent-tab {
  height: calc(100vh - 200px);
  display: flex;
  flex-direction: row;
  position: relative;
  overflow: hidden;
}

/* 세션 사이드바 - 데스크탑: 항상 표시 */
.session-overlay { display: none; }

.session-sidebar {
  width: 230px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--card-border);
  background: var(--surface);
}
.session-sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0.75rem 0.6rem;
  border-bottom: 1px solid var(--card-border);
  gap: 0.5rem;
}
.session-sidebar__title {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
  letter-spacing: 0.02em;
}
.btn-new-chat {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.65rem;
  background: transparent;
  border: 1px solid var(--card-border);
  border-radius: 999px;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}
.btn-new-chat:hover { border-color: var(--accent); color: var(--accent); background: rgba(76,175,80,0.06); }

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.4rem 0;
}
.session-empty {
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.78rem;
  padding: 1.5rem 0.75rem;
  line-height: 1.6;
}
.session-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.55rem 0.6rem 0.55rem 0.75rem;
  cursor: pointer;
  border-radius: 7px;
  margin: 0.1rem 0.35rem;
  transition: background 0.15s;
}
.session-item:hover { background: rgba(128,128,128,0.08); }
.session-item--active { background: rgba(76, 175, 80, 0.12); }
.session-group-label {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.65rem 0.75rem 0.25rem;
  opacity: 0.7;
}
.session-item__body { flex: 1; min-width: 0; }
.session-item__title {
  font-size: 0.83rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}
.btn-delete-session {
  display: none;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.2rem;
  border-radius: 4px;
  flex-shrink: 0;
  transition: color 0.15s;
  align-items: center;
  justify-content: center;
}
.session-item:hover .btn-delete-session { display: flex; }
.btn-delete-session:hover { color: #e53935; }

/* 채팅 영역 */
.agent-section { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
.agent-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}
.btn-sidebar-toggle {
  display: none; /* 데스크탑에서는 숨김 */
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  align-items: center;
  transition: color 0.2s;
  flex-shrink: 0;
}
.btn-sidebar-toggle:hover { color: var(--accent); }

/* 모바일 반응형 */
@media (max-width: 640px) {
  .agent-tab { height: calc(100vh - 160px); }

  .session-overlay {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 199;
    background: rgba(0,0,0,0.45);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s;
  }
  .session-overlay--show { opacity: 1; pointer-events: auto; }

  .session-sidebar {
    position: fixed;
    left: 0; top: 0; bottom: 0;
    width: 78%;
    max-width: 280px;
    z-index: 200;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    border-right: 1px solid var(--card-border);
  }
  .session-sidebar--open { transform: translateX(0); }

  .btn-sidebar-toggle { display: flex; }
  .btn-delete-session { display: flex; } /* 모바일: 항상 표시 */
}

.chat-history {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  background: var(--bg);
  margin-bottom: 0.75rem;
  min-height: 300px;
  max-height: calc(100vh - 380px);
  transition: border-color 0.15s, background 0.15s;
}
.chat-history--drag {
  border-color: var(--accent);
  background: rgba(76, 175, 80, 0.04);
}

.chat-empty {
  margin: auto;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.88rem;
  line-height: 1.8;
}

.chat-drop-hint {
  position: sticky;
  bottom: 0;
  text-align: center;
  padding: 0.5rem;
  color: var(--accent);
  font-size: 0.85rem;
  font-weight: 500;
  pointer-events: none;
}

.chat-msg { display: flex; }
.chat-msg--user  { justify-content: flex-end; }
.chat-msg--agent { justify-content: flex-start; }

.chat-msg__bubble {
  max-width: 75%;
  padding: 0.65rem 0.9rem;
  border-radius: 12px;
  font-size: 0.88rem;
  line-height: 1.7;
}

.chat-msg--user  .chat-msg__bubble { background: var(--accent); color: #fff; border-bottom-right-radius: 4px; }
.chat-msg--agent .chat-msg__bubble { background: var(--surface); border: 1px solid var(--card-border); border-bottom-left-radius: 4px; }

.chat-msg__image {
  display: block;
  max-width: 200px;
  max-height: 150px;
  border-radius: 6px;
  margin-bottom: 0.4rem;
  object-fit: cover;
}

.chat-msg__bubble--loading { padding: 0.75rem 1.2rem; }

/* 점 로딩 애니메이션 */
.dot-pulse {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--text-secondary);
  animation: dot-pulse 1.2s infinite;
  position: relative;
}
.dot-pulse::before,
.dot-pulse::after {
  content: '';
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--text-secondary);
  position: absolute;
  top: 0;
}
.dot-pulse::before { left: -14px; animation: dot-pulse 1.2s 0.2s infinite; }
.dot-pulse::after  { left: 14px;  animation: dot-pulse 1.2s 0.4s infinite; }

@keyframes dot-pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}

/* 입력 영역 */
.chat-input-area {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  background: var(--surface);
}

.attach-btn {
  padding: 0.5rem;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 6px;
  transition: color 0.2s;
  flex-shrink: 0;
}
.attach-btn:hover { color: var(--accent); }

.chat-input-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.agent-file-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  color: var(--accent);
  background: rgba(var(--accent-rgb, 76,175,80), 0.1);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  width: fit-content;
}
.agent-file-chip button {
  background: none; border: none; color: var(--accent);
  cursor: pointer; font-size: 1rem; line-height: 1; padding: 0;
}

.chat-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.9rem;
  resize: none;
  line-height: 1.5;
  font-family: inherit;
}

.send-btn {
  padding: 0.5rem 0.75rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.2s;
}
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

:deep(.md-heading) { display: block; margin: 0.5rem 0 0.25rem; font-size: 0.95rem; }
</style>
