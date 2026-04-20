<template>
  <div class="gel-analysis">

    <!-- 탭 헤더 -->
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'train' }"
        @click="activeTab = 'train'"
      >
        학습 데이터 관리
      </button>
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'agent' }"
        @click="activeTab = 'agent'"
      >
        AI 에이전트
      </button>
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'predict' }"
        @click="activeTab = 'predict'"
      >
        Ct값 예측
      </button>

      <!-- 모델 상태 배지 -->
      <div class="model-badge" :class="modelStatus.trained && records.length > 0 ? 'model-badge--ok' : 'model-badge--none'">
        <span v-if="modelStatus.trained && records.length > 0">
          {{ modelStatus.model_type }} · R²{{ modelStatus.cv_r2_mean }} · {{ modelStatus.sample_count }}개
        </span>
        <span v-else>모델 미학습</span>
      </div>
    </div>

    <!-- ────────────── 탭 1: 학습 데이터 관리 ────────────── -->
    <div v-if="activeTab === 'train'" class="tab-content">

      <!-- 업로드 폼 -->
      <section class="upload-section">
        <h2 class="section-title">학습 데이터 등록</h2>
        <p class="section-desc">PCR 젤 이미지를 업로드하고 각 레인의 실측 Ct값을 입력합니다. 등록 시 AI가 각 레인의 <strong>ROI(타겟 밴드 영역)</strong>를 자동 추출하고 픽셀 밝기를 정규화(Intensity Normalization)하여 학습에 반영합니다.</p>

        <div class="upload-row">
          <!-- 드래그&드롭 영역 -->
          <div
            class="upload-area"
            :class="{ 'upload-area--drag': isDraggingMulti }"
            @dragover.prevent="isDraggingMulti = true"
            @dragleave.prevent="isDraggingMulti = false"
            @drop.prevent="onMultiLaneDrop"
          >
            <input
              ref="multiLaneFileInput"
              type="file"
              accept="image/*"
              class="upload-area__input"
              @change="onMultiLaneFileChange"
            />
            <div class="upload-area__inner" @click="$refs.multiLaneFileInput.click()">
              <div class="upload-area__icon">🧫</div>
              <p v-if="!multiLaneFile" class="upload-area__text">젤 이미지를 끌어다 놓거나 클릭</p>
              <p v-else class="upload-area__text">{{ multiLaneFile.name }}</p>
              <p class="upload-area__sub">JPG, PNG · 최대 20MB</p>
            </div>
          </div>

          <!-- 레인 분석 / Ct 자동 추출 버튼 -->
          <div class="ct-input-group">
            <button
              class="btn-secondary"
              :disabled="!multiLaneFile || isExtractingLanes"
              @click="extractLanesForTraining"
            >
              <span v-if="isExtractingLanes" class="spinner spinner--dark"></span>
              <span v-else>레인 분석</span>
            </button>
            <button
              class="btn-secondary"
              style="margin-top:0.35rem"
              :disabled="!multiLaneFile || isExtractingCt"
              @click="autoExtractCt"
              title="이미지에 표시된 Ct값을 AI가 자동으로 읽어옵니다"
            >
              <span v-if="isExtractingCt" class="spinner spinner--dark"></span>
              <span v-else>✨ Ct 자동 추출</span>
            </button>
            <p v-if="multiLaneFile" class="file-chip" style="margin-top:0.35rem">
              <span>{{ multiLaneFile.name }}</span>
              <button class="file-chip__remove" @click="multiLaneFile = null; multiLaneExtracted = []; laneCtInputs = {}">×</button>
            </p>
          </div>
        </div>

        <!-- 레인별 Ct값 입력 테이블 -->
        <div v-if="multiLaneExtracted.length > 0" class="lane-result-wrap" style="margin-top:1rem">
          <div class="lane-result-header">
            <span class="lane-result-title">레인별 Ct값 입력</span>
          </div>
          <div class="records-table-wrap">
            <table class="records-table lane-table">
              <thead>
                <tr>
                  <th>레인</th>
                  <th>레이블</th>
                  <th>밝기</th>
                  <th>상태</th>
                  <th>실측 Ct값</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="lane in multiLaneExtracted"
                  :key="lane.laneIndex"
                  :class="lane.concentrationLabel === 'M' || lane.concentrationLabel === 'NTC' ? 'row--muted' : ''"
                >
                  <td>{{ lane.laneIndex }}</td>
                  <td class="lane-label-cell">{{ lane.concentrationLabel }}</td>
                  <td>{{ fmt(lane.bandIntensity) }}</td>
                  <td>
                    <span v-if="lane.concentrationLabel === 'M'" class="chip chip--gray">래더</span>
                    <span v-else-if="lane.concentrationLabel === 'NTC'" class="chip chip--gray">음성대조</span>
                    <span v-else-if="lane.isSaturated" class="chip chip--orange">포화</span>
                    <span v-else-if="lane.isNegative" class="chip chip--gray">미검출</span>
                    <span v-else class="chip chip--green">검출</span>
                  </td>
                  <td>
                    <input
                      v-if="lane.concentrationLabel !== 'M' && lane.concentrationLabel !== 'NTC'"
                      v-model.number="laneCtInputs[lane.concentrationLabel]"
                      type="number"
                      step="0.01"
                      min="0"
                      max="50"
                      placeholder="예: 24.35"
                      class="ct-input ct-input--sm"
                    />
                    <span v-else class="muted">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="predict-actions" style="margin-top:0.75rem">
            <button
              class="btn-primary"
              :disabled="isUploadingMultiLane || Object.keys(laneCtInputs).length === 0"
              @click="uploadMultiLaneGel"
            >
              <span v-if="isUploadingMultiLane" class="spinner"></span>
              <span v-else>저장</span>
            </button>
          </div>
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
        <p class="section-desc">저장된 학습 데이터 전체를 사용해 모델을 재학습합니다. 최소 3개 이상 필요. 학습 목표: ① mecA 이진 분류(양성/음성) ② 저농도(10¹~10³) LOD 탐지 ③ 프라이머 다이머 노이즈 필터링.</p>

        <div v-if="trainResult" class="result-box result-box--info">
          <strong>학습 완료</strong> · 모델: {{ trainResult.model_type }}
          · 학습 R²: {{ trainResult.train_r2 }}
          · CV R²: {{ trainResult.cv_r2_mean }} ± {{ trainResult.cv_r2_std }}
          · RMSE: {{ trainResult.train_rmse }} Ct
          · 샘플: {{ trainResult.sample_count }}개
          <br><span class="result-objectives">학습 목표 반영: mecA 이진 분류 · 저농도(10¹~10³) LOD 탐지 · 프라이머 다이머 노이즈 필터링</span>
        </div>
      </section>

      <!-- 학습 데이터 목록 -->
      <section class="records-section">
        <div class="records-header">
          <h2 class="section-title">학습 데이터 목록</h2>
          <button
            v-if="selectedIds.length > 0"
            class="btn-delete-selected"
            :disabled="isDeleting"
            @click="deleteSelected"
          >
            <span v-if="isDeleting" class="spinner spinner--sm spinner--red"></span>
            <span v-else>선택 삭제 ({{ selectedIds.length }}개)</span>
          </button>
        </div>

        <div v-if="isLoadingRecords" class="list-loading">
          <div class="spinner"></div>
        </div>

        <div v-else-if="records.length === 0" class="list-empty">
          등록된 학습 데이터가 없습니다.
        </div>

        <div v-else class="records-table-wrap">
          <table class="records-table">
            <thead>
              <tr>
                <th class="col-check">
                  <input
                    type="checkbox"
                    class="row-checkbox"
                    :checked="allSelected"
                    :ref="el => { if (el) el.indeterminate = someSelected }"
                    @change="toggleSelectAll"
                  />
                </th>
                <th>파일명</th>
                <th>레인</th>
                <th>레이블</th>
                <th>Ct값</th>
                <th>밝기</th>
                <th>면적</th>
                <th>상대강도</th>
                <th>등록일</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in records"
                :key="r.id"
                :class="{ 'row--warn': r.warning, 'row--selected': selectedIds.includes(r.id) }"
                @click="toggleSelect(r.id)"
              >
                <td class="col-check" @click.stop>
                  <input
                    type="checkbox"
                    class="row-checkbox"
                    :value="r.id"
                    v-model="selectedIds"
                  />
                </td>
                <td class="col-name">{{ r.fileName }}</td>
                <td>{{ r.laneIndex }}</td>
                <td class="lane-label-cell">{{ r.concentrationLabel || '—' }}</td>
                <td class="col-ct">{{ r.ctValue }}</td>
                <td>{{ fmt(r.bandIntensity) }}</td>
                <td>{{ fmt(r.bandArea) }}</td>
                <td>{{ fmt(r.relativeIntensity) }}</td>
                <td class="col-date">{{ formatDate(r.createdAt) }}</td>
                <td @click.stop>
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
        <p class="section-desc">젤 이미지를 여러 장 업로드하면 이미지당 10개 레인을 분석하여 레인별 Ct값을 예측합니다.</p>

        <div v-if="!modelStatus.trained" class="result-box result-box--warn">
          모델이 아직 학습되지 않았습니다. 학습 데이터 탭에서 데이터를 등록하고 학습을 실행하세요.
        </div>

        <!-- 멀티 업로드 영역 -->
        <div
          class="upload-area upload-area--wide"
          :class="{ 'upload-area--drag': isGelPredictDragging }"
          @dragover.prevent="isGelPredictDragging = true"
          @dragleave.prevent="isGelPredictDragging = false"
          @drop.prevent="onGelPredictDrop"
        >
          <input
            ref="gelPredictFileInput"
            type="file"
            accept="image/*"
            multiple
            class="upload-area__input"
            @change="onGelPredictFilesChange"
          />
          <div class="upload-area__inner" @click="$refs.gelPredictFileInput.click()">
            <div class="upload-area__icon">🔬</div>
            <p class="upload-area__text">젤 이미지를 끌어다 놓거나 클릭 (여러 장 가능)</p>
            <p class="upload-area__sub">JPG, PNG · 최대 20MB</p>
          </div>
        </div>

        <!-- 액션 버튼 -->
        <div class="predict-actions" style="margin-top:0.75rem">
          <button
            class="btn-secondary"
            :disabled="!hasPendingGelItems || isAnyGelPredicting || !modelStatus.trained"
            @click="predictAllGelLanes"
          >
            <span v-if="isAnyGelPredicting" class="spinner spinner--dark"></span>
            <span v-else>전체 예측 ({{ gelPredictItems.filter(i => i.status === 'pending').length }}개)</span>
          </button>
          <span class="predict-count">{{ gelPredictItems.length }}개 이미지</span>
          <button v-if="gelPredictItems.length > 0" class="btn-clear" @click="clearGelPredict">전체 초기화</button>
        </div>

        <!-- 이미지별 결과 -->
        <div
          v-for="(item, idx) in gelPredictItems"
          :key="idx"
          class="gel-predict-panel"
          :class="{
            'gel-predict-panel--done': item.status === 'done',
            'gel-predict-panel--error': item.status === 'error'
          }"
        >
          <!-- 패널 헤더 -->
          <div class="gel-predict-panel__header">
            <span class="gel-predict-panel__name">{{ item.file.name }}</span>
            <span v-if="item.status === 'pending'" class="chip chip--gray">대기</span>
            <span v-else-if="item.status === 'predicting'" class="chip chip--orange">분석 중</span>
            <span v-else-if="item.status === 'error'" class="chip chip--red">오류</span>
            <span v-if="item.status === 'done' && itemLod(item)" class="lod-badge">LOD: {{ itemLod(item) }}</span>
            <div style="margin-left:auto;display:flex;gap:0.5rem;align-items:center">
              <button
                class="btn-secondary"
                style="padding:0.3rem 0.75rem;font-size:0.8rem"
                :disabled="item.status === 'predicting' || !modelStatus.trained"
                @click="predictSingleGelItem(item)"
              >
                <span v-if="item.status === 'predicting'" class="spinner spinner--dark spinner--sm"></span>
                <span v-else>예측</span>
              </button>
              <button class="btn-delete" @click="removeGelPredictItem(idx)">×</button>
            </div>
          </div>

          <!-- 오류 메시지 -->
          <p v-if="item.status === 'error'" class="error-text" style="margin:0.4rem 0 0;font-size:0.82rem">
            {{ item.errorMsg }}
          </p>

          <!-- 레인 결과 테이블 -->
          <div v-if="item.status === 'done' && item.laneResults.length > 0" class="lane-result-wrap" style="margin-top:0.75rem">
            <div class="records-table-wrap">
              <table class="records-table lane-table">
                <thead>
                  <tr>
                    <th>레인</th>
                    <th>레이블</th>
                    <th>예측 Ct</th>
                    <th>실측 Ct</th>
                    <th>밝기</th>
                    <th>상대강도</th>
                    <th>밴드 면적</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="lane in item.laneResults"
                    :key="lane.laneIndex"
                    :class="laneRowClass(lane)"
                  >
                    <td>{{ lane.laneIndex }}</td>
                    <td class="lane-label-cell">{{ lane.concentrationLabel }}</td>
                    <td class="col-ct">
                      <span v-if="lane.concentrationLabel === 'M' || lane.concentrationLabel === 'NTC'" class="muted">—</span>
                      <span v-else-if="lane.isNegative" class="muted">—</span>
                      <span v-else>{{ lane.predictedCt != null ? lane.predictedCt.toFixed(2) : '—' }}</span>
                    </td>
                    <td>
                      <input
                        v-if="lane.concentrationLabel !== 'M' && lane.concentrationLabel !== 'NTC'"
                        v-model.number="item.actualCtInputs[lane.concentrationLabel]"
                        type="number"
                        step="0.01"
                        min="0"
                        max="50"
                        placeholder="실측값"
                        class="ct-input ct-input--sm ct-input--actual"
                      />
                      <span v-else class="muted">—</span>
                    </td>
                    <td>{{ fmt(lane.bandIntensity) }}</td>
                    <td>{{ fmt(lane.relativeIntensity) }}</td>
                    <td>{{ fmt(lane.bandArea) }}</td>
                    <td>
                      <span v-if="lane.concentrationLabel === 'M'" class="chip chip--gray">래더</span>
                      <span v-else-if="lane.concentrationLabel === 'NTC' && lane.isNegative" class="chip chip--green">NTC 음성</span>
                      <span v-else-if="lane.concentrationLabel === 'NTC' && !lane.isNegative" class="chip chip--red">오염의심 ⚠</span>
                      <span v-else-if="lane.isSaturated" class="chip chip--orange">포화 (고농도)</span>
                      <span v-else-if="lane.isNegative" class="chip chip--gray">mecA 음성</span>
                      <span v-else-if="lane.isPrimerDimer" class="chip chip--orange">다이머 노이즈</span>
                      <span v-else class="chip chip--green">mecA 양성</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <!-- 저농도 구간(LOD) 전용 요약 -->
            <div class="lod-summary">
              <div class="lod-summary__title">저농도 구간 집중 분석 (10¹~10³)</div>
              <div class="lod-summary__lanes">
                <div
                  v-for="entry in itemLowConcLanes(item)"
                  :key="entry.label"
                  class="lod-lane-card"
                  :class="entry.lane ? (entry.detected ? 'lod-lane-card--pos' : 'lod-lane-card--neg') : 'lod-lane-card--missing'"
                >
                  <span class="lod-lane-card__label">{{ entry.label }}</span>
                  <span v-if="!entry.lane" class="lod-lane-card__status muted">레인 없음</span>
                  <template v-else>
                    <span class="lod-lane-card__status">{{ entry.detected ? 'mecA 양성' : 'mecA 음성' }}</span>
                    <span class="lod-lane-card__intensity">강도: {{ fmt(entry.lane.relativeIntensity) }}</span>
                  </template>
                </div>
              </div>
              <p v-if="itemLod(item)" class="lod-desc">
                검출 한계(LOD): <strong>{{ itemLod(item) }}</strong> — Tm 59.72°C 프라이머 기준, 육안 확인 불가 구간에서의 AI 탐지 결과입니다.
              </p>
              <p v-else class="lod-desc lod-desc--none">저농도 구간(10¹~10³) 전 레인 mecA 음성 — LOD 미달 또는 음성 샘플.</p>
            </div>

            <!-- 학습 데이터 등록 -->
            <div class="register-training-wrap">
              <div class="register-training-hint">실측 Ct값을 입력한 레인을 학습 데이터로 등록합니다.</div>
              <div class="register-training-actions">
                <button
                  class="btn-primary"
                  :disabled="item.isRegistering || !hasActualCt(item)"
                  @click="uploadPredictAsTraining(item)"
                >
                  <span v-if="item.isRegistering" class="spinner"></span>
                  <span v-else>학습 데이터로 등록 ({{ countActualCt(item) }}개 레인)</span>
                </button>
                <span
                  v-if="item.registerMsg"
                  class="register-msg"
                  :class="{
                    'register-msg--ok': item.registerMsg.type === 'ok',
                    'register-msg--dup': item.registerMsg.type === 'duplicate',
                    'register-msg--err': item.registerMsg.type === 'error'
                  }"
                >{{ item.registerMsg.text }}</span>
              </div>
            </div>
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
          젤 이미지 첨부 시 M·10⁸~10¹·NTC 전체 레인을 분석합니다.
          ① <strong>mecA 이진 분류</strong>(양성/음성) ② 육안 미검출 저농도(10¹~10³) <strong>LOD 탐지 확률</strong> ③ 프라이머 다이머와 실제 밴드를 구분하는 <strong>노이즈 필터링</strong>을 중점 해석합니다.
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
              <div class="loading-status">
                <span class="loading-status__text">{{ loadingStatusText }}</span>
                <span class="loading-status__elapsed">{{ loadingElapsed }}s</span>
              </div>
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

      // 학습 데이터 업로드
      selectedFile: null,
      ctValue: null,
      isDragging: false,
      isUploading: false,
      uploadResult: null,

      // 학습
      isTraining: false,
      trainResult: null,

      // 목록
      records: [],
      isLoadingRecords: false,
      selectedIds: [],
      isDeleting: false,

      // 멀티레인 Ct값 예측 (멀티 이미지)
      gelPredictItems: [],
      isGelPredictDragging: false,

      // 멀티레인 학습 데이터 업로드
      multiLaneFile: null,
      multiLaneExtracted: [],
      laneCtInputs: {},
      isExtractingLanes: false,
      isExtractingCt: false,
      isUploadingMultiLane: false,
      isDraggingMulti: false,

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
      isSidebarOpen: false,
      loadingElapsed: 0,
      loadingStatusText: '요청 전송 중...',
      loadingTimer: null
    }
  },
  mounted() {
    this.loadRecords()
    this.loadModelStatus()
    this.loadSessionList()
  },
  computed: {
    allSelected() {
      return this.records.length > 0 && this.selectedIds.length === this.records.length
    },
    someSelected() {
      return this.selectedIds.length > 0 && this.selectedIds.length < this.records.length
    },
    hasPendingGelItems() {
      return this.gelPredictItems.some(i => i.status === 'pending')
    },
    isAnyGelPredicting() {
      return this.gelPredictItems.some(i => i.status === 'predicting')
    },
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

    onGelPredictFilesChange(e) {
      this.addGelPredictFiles(Array.from(e.target.files))
      e.target.value = ''
    },
    onGelPredictDrop(e) {
      this.isGelPredictDragging = false
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
      this.addGelPredictFiles(files)
    },
    addGelPredictFiles(files) {
      for (const file of files) {
        this.gelPredictItems.push({
          file,
          imageUrl: URL.createObjectURL(file),
          status: 'pending',
          laneResults: [],
          errorMsg: '',
          actualCtInputs: {},
          isRegistering: false,
          registerMsg: null
        })
      }
    },
    removeGelPredictItem(idx) {
      URL.revokeObjectURL(this.gelPredictItems[idx].imageUrl)
      this.gelPredictItems.splice(idx, 1)
    },
    clearGelPredict() {
      for (const item of this.gelPredictItems) URL.revokeObjectURL(item.imageUrl)
      this.gelPredictItems = []
      if (this.$refs.gelPredictFileInput) this.$refs.gelPredictFileInput.value = ''
    },
    async predictSingleGelItem(item) {
      item.status = 'predicting'
      item.laneResults = []
      try {
        const form = new FormData()
        form.append('file', item.file)
        const { data } = await api.post('/api/gel/predict-gel', form)
        item.laneResults = Array.isArray(data) ? data : []
        item.status = 'done'
      } catch (e) {
        item.status = 'error'
        item.errorMsg = e.response?.data?.error || e.message
      }
    },
    async predictAllGelLanes() {
      const pending = this.gelPredictItems.filter(i => i.status === 'pending')
      for (const item of pending) {
        await this.predictSingleGelItem(item)
      }
    },
    itemLod(item) {
      const detected = item.laneResults.filter(l =>
        l.concentrationLabel !== 'M' && l.concentrationLabel !== 'NTC' && !l.isNegative
      )
      if (detected.length === 0) return null
      return detected.reduce((min, l) => {
        const v = parseFloat(l.concentrationLabel?.replace('10^', '') ?? '999')
        const mv = parseFloat(min.concentrationLabel?.replace('10^', '') ?? '999')
        return v < mv ? l : min
      }).concentrationLabel
    },
    laneRowClass(lane) {
      const low = ['10^1', '10^2', '10^3']
      if (lane.concentrationLabel === 'M' || lane.concentrationLabel === 'NTC') return 'row--muted'
      if (low.includes(lane.concentrationLabel)) return lane.isNegative ? 'row--low-conc-neg' : 'row--low-conc'
      return ''
    },
    hasActualCt(item) {
      return Object.values(item.actualCtInputs).some(v => v !== null && v !== '' && !isNaN(Number(v)))
    },
    countActualCt(item) {
      return Object.values(item.actualCtInputs).filter(v => v !== null && v !== '' && !isNaN(Number(v))).length
    },
    async uploadPredictAsTraining(item) {
      item.isRegistering = true
      item.registerMsg = null
      try {
        const ctMap = Object.fromEntries(
          Object.entries(item.actualCtInputs)
            .filter(([, v]) => v !== null && v !== '' && !isNaN(Number(v)))
            .map(([k, v]) => [k, Number(v)])
        )
        const form = new FormData()
        form.append('file', item.file)
        form.append('ctValues', JSON.stringify(ctMap))
        const { data } = await api.post('/api/gel/upload-gel', form)
        if (data.duplicate) {
          item.registerMsg = { type: 'duplicate', text: '이미 등록된 데이터입니다.' }
        } else {
          const count = Array.isArray(data) ? data.length : 0
          item.registerMsg = { type: 'ok', text: `${count}개 레인이 학습 데이터로 등록되었습니다.` }
          await this.loadRecords()
        }
      } catch (e) {
        if (e.response?.status === 409) {
          item.registerMsg = { type: 'duplicate', text: '이미 등록된 데이터입니다.' }
        } else {
          item.registerMsg = { type: 'error', text: '등록 실패: ' + (e.response?.data?.error || e.message) }
        }
      } finally {
        item.isRegistering = false
      }
    },
    itemLowConcLanes(item) {
      const labels = ['10^1', '10^2', '10^3']
      return labels.map(label => {
        const lane = item.laneResults.find(l => l.concentrationLabel === label)
        return { label, lane, detected: lane && !lane.isNegative }
      })
    },
    onMultiLaneFileChange(e) {
      this.multiLaneFile = e.target.files[0] || null
      this.multiLaneExtracted = []
      this.laneCtInputs = {}
    },
    onMultiLaneDrop(e) {
      this.isDraggingMulti = false
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) {
        this.multiLaneFile = file
        this.multiLaneExtracted = []
        this.laneCtInputs = {}
      }
    },
    async autoExtractCt() {
      if (!this.multiLaneFile) return
      this.isExtractingCt = true
      try {
        const form = new FormData()
        form.append('file', this.multiLaneFile)
        const { data } = await api.post('/api/gel/auto-ct', form)
        const count = Object.keys(data).length
        if (count === 0) {
          alert('이미지에서 Ct값을 찾지 못했습니다.\n이미지에 "Ct = 숫자" 형태의 텍스트가 있는지 확인하세요.')
        } else {
          Object.assign(this.laneCtInputs, data)
          alert(`${count}개 레인의 Ct값이 자동으로 입력되었습니다.`)
        }
      } catch (e) {
        alert('Ct값 자동 추출 실패: ' + (e.response?.data?.error || e.message))
      } finally {
        this.isExtractingCt = false
      }
    },
    async extractLanesForTraining() {
      if (!this.multiLaneFile) return
      this.isExtractingLanes = true
      this.multiLaneExtracted = []
      this.laneCtInputs = {}
      try {
        const form = new FormData()
        form.append('file', this.multiLaneFile)
        const { data } = await api.post('/api/gel/extract-gel', form)
        this.multiLaneExtracted = Array.isArray(data) ? data : []
      } catch (e) {
        alert('레인 분석 실패: ' + (e.response?.data?.error || e.message))
      } finally {
        this.isExtractingLanes = false
      }
    },
    async uploadMultiLaneGel() {
      if (Object.keys(this.laneCtInputs).length === 0) return
      this.isUploadingMultiLane = true
      try {
        const form = new FormData()
        form.append('file', this.multiLaneFile)
        form.append('ctValues', JSON.stringify(this.laneCtInputs))
        const { data } = await api.post('/api/gel/upload-gel', form)
        if (data.duplicate) {
          alert('이미 등록된 데이터입니다.')
        } else {
          const count = Array.isArray(data) ? data.length : 0
          alert(`${count}개 레인이 저장되었습니다.`)
          this.multiLaneFile = null
          this.multiLaneExtracted = []
          this.laneCtInputs = {}
          if (this.$refs.multiLaneFileInput) this.$refs.multiLaneFileInput.value = ''
          await this.loadRecords()
        }
      } catch (e) {
        if (e.response?.status === 409) {
          alert('이미 등록된 데이터입니다.')
        } else {
          alert('업로드 실패: ' + (e.response?.data?.error || e.message))
        }
      } finally {
        this.isUploadingMultiLane = false
      }
    },

    // ── 학습 데이터 업로드 ──────────────────────────────────────
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
      if (!confirm('이 학습 데이터를 삭제하시겠습니까?')) return
      try {
        await api.delete(`/api/gel/records/${id}`)
        this.records = this.records.filter(r => r.id !== id)
        this.selectedIds = this.selectedIds.filter(sid => sid !== id)
        if (this.records.length === 0) await this.resetModel()
        else await this.loadModelStatus()
      } catch (e) {
        alert('삭제 실패: ' + (e.response?.data || e.message))
      }
    },
    async deleteSelected() {
      if (!confirm(`선택한 ${this.selectedIds.length}개의 학습 데이터를 삭제하시겠습니까?`)) return
      this.isDeleting = true
      try {
        await Promise.all(this.selectedIds.map(id => api.delete(`/api/gel/records/${id}`)))
        const deletedSet = new Set(this.selectedIds)
        this.records = this.records.filter(r => !deletedSet.has(r.id))
        this.selectedIds = []
        if (this.records.length === 0) await this.resetModel()
        else await this.loadModelStatus()
      } catch (e) {
        alert('일부 삭제 실패: ' + (e.response?.data || e.message))
        await this.loadRecords()
        this.selectedIds = []
      } finally {
        this.isDeleting = false
      }
    },
    toggleSelectAll() {
      if (this.allSelected) {
        this.selectedIds = []
      } else {
        this.selectedIds = this.records.map(r => r.id)
      }
    },
    toggleSelect(id) {
      const idx = this.selectedIds.indexOf(id)
      if (idx === -1) this.selectedIds.push(id)
      else this.selectedIds.splice(idx, 1)
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


    // ── 모델 상태 ───────────────────────────────────────────────
    async resetModel() {
      try {
        await api.delete('/api/gel/model')
      } catch { /* 무시 */ }
      await this.loadModelStatus()
    },
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
          this.agentMessages = data.map(m => ({ role: m.role, text: m.text, hadImage: !!m.hadImage, imageUrl: m.imageUrl || null }))
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
          this.agentMessages = data.map(m => ({ role: m.role, text: m.text, hadImage: !!m.hadImage, imageUrl: m.imageUrl || null }))
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

      this.agentMessages.push({ role: 'user', text: text || '(이미지 분석 요청)', imageUrl })
      this.agentInput = ''
      this.agentFile = null
      this.isAgentLoading = true
      this.loadingElapsed = 0
      this.loadingStatusText = '요청 전송 중...'
      this.loadingTimer = setInterval(() => { this.loadingElapsed++ }, 1000)
      this.$nextTick(() => this.scrollChat())

      const form = new FormData()
      form.append('message', text || '이 이미지를 분석해주세요.')
      if (file) form.append('file', file)
      if (this.agentSessionId) form.append('sessionId', this.agentSessionId)

      try {
        const baseURL = api.defaults.baseURL || ''
        const response = await fetch(`${baseURL}/api/agent/chat/stream`, {
          method: 'POST',
          body: form
        })

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        const handleBlock = (block) => {
          const eventMatch = block.match(/event:\s*(\S+)/)
          const dataMatch  = block.match(/data:\s*([\s\S]+)/)
          if (!eventMatch || !dataMatch) return
          const evtName = eventMatch[1]
          const evtData = dataMatch[1].trim()

          if (evtName === 'progress') {
            this.loadingStatusText = evtData
            this.$nextTick(() => this.scrollChat())
          } else if (evtName === 'done') {
            const parsed = JSON.parse(evtData)
            this.agentSessionId = parsed.sessionId
            this.agentMessages.push({ role: 'agent', text: parsed.message })
          } else if (evtName === 'error') {
            this.agentMessages.push({ role: 'agent', text: '오류가 발생했습니다: ' + evtData })
          }
        }

        for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
          const { value } = chunk
          buffer += decoder.decode(value, { stream: true })

          const parts = buffer.split('\n\n')
          buffer = parts.pop()
          for (const block of parts) {
            if (block.trim()) handleBlock(block)
          }
        }

        if (buffer.trim()) handleBlock(buffer)
      } catch (e) {
        this.agentMessages.push({ role: 'agent', text: '오류가 발생했습니다: ' + e.message })
      } finally {
        this.isAgentLoading = false
        clearInterval(this.loadingTimer)
        this.loadingTimer = null
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

/* ── 테이블 헤더 ───────────────────────────────────────────── */
.records-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.25rem;
}

.btn-delete-selected {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.9rem;
  background: rgba(229, 57, 53, 0.1);
  color: #e53935;
  border: 1px solid #e53935;
  border-radius: 6px;
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-delete-selected:hover:not(:disabled) { background: rgba(229, 57, 53, 0.18); }
.btn-delete-selected:disabled { opacity: 0.5; cursor: not-allowed; }

.spinner--red {
  border-color: rgba(229,57,53,0.25);
  border-top-color: #e53935;
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

.records-table tbody tr {
  cursor: pointer;
  transition: background 0.12s;
}
.records-table tbody tr:hover { background: rgba(128,128,128,0.06); }

.col-check { width: 36px; padding-left: 0.75rem; }
.row-checkbox { cursor: pointer; width: 15px; height: 15px; accent-color: var(--accent); }
.col-name { max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
.col-ct   { font-weight: 600; color: var(--accent); }
.col-date { color: var(--text-secondary); }

.row--warn td     { background: rgba(255, 152, 0, 0.05); }
.row--selected td { background: rgba(76, 175, 80, 0.07); }

/* ── 예측 멀티 업로드 ──────────────────────────────────────── */
.upload-area--wide {
  width: 100%;
  min-height: 100px;
}

.predict-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.predict-count {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.btn-clear {
  padding: 0.45rem 0.9rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--card-border);
  border-radius: 6px;
  font-size: 0.82rem;
  cursor: pointer;
  margin-left: auto;
}
.btn-clear:hover { border-color: #e57373; color: #e57373; }

.predict-items {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 0.75rem;
}

.predict-item {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: var(--surface);
  flex-wrap: wrap;
}
.predict-item--done       { border-color: rgba(76,175,80,0.4); }
.predict-item--registered { border-color: rgba(33,150,243,0.4); background: rgba(33,150,243,0.04); }
.predict-item--duplicate  { border-color: rgba(158,158,158,0.4); background: rgba(158,158,158,0.04); opacity: 0.7; }
.predict-item--error      { border-color: rgba(229,57,53,0.4); }

.predict-item__thumb {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
  background: var(--bg);
}

.predict-item__info {
  flex: 1;
  min-width: 120px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.predict-item__name {
  font-size: 0.83rem;
  font-weight: 500;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 240px;
}

.predict-item__status { font-size: 0.78rem; }

.status--pending    { color: var(--text-secondary); }
.status--predicting { color: var(--accent); }
.status--done       { color: #4caf50; }
.status--registered { color: #2196f3; }
.status--duplicate  { color: #9e9e9e; }
.status--error      { color: #e53935; }

.status-predicting {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.predict-item__features {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.2rem;
}

.predict-item__ct-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  min-width: 72px;
}

.predict-item__ct-label { font-size: 0.72rem; color: var(--text-secondary); }
.predict-item__ct-value { font-size: 1.3rem; font-weight: 700; color: var(--accent); }

.predict-item__edit {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 100px;
}

.predict-item__edit-label { font-size: 0.72rem; color: var(--text-secondary); }

.ct-input--sm {
  padding: 0.35rem 0.5rem;
  font-size: 0.88rem;
  width: 100px;
}

.ct-input--actual {
  width: 80px;
  border-color: rgba(33, 150, 243, 0.5);
}
.ct-input--actual:focus { border-color: #2196f3; }

/* ── 학습 데이터 등록 영역 ──────────────────────────────────── */
.register-training-wrap {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px dashed var(--card-border);
  border-radius: 8px;
}

.register-training-hint {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.register-training-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.register-msg {
  font-size: 0.82rem;
  font-weight: 500;
}
.register-msg--ok  { color: #4caf50; }
.register-msg--dup { color: #ff9800; }
.register-msg--err { color: #e53935; }

.spinner--dark {
  border-color: rgba(0,0,0,0.15);
  border-top-color: currentColor;
}

.spinner--sm {
  width: 10px;
  height: 10px;
  border-width: 1.5px;
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

.chat-msg__bubble--loading {
  padding: 0.7rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.loading-status {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.loading-status__text {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.loading-status__elapsed {
  font-size: 0.72rem;
  color: var(--text-secondary);
  opacity: 0.45;
  font-variant-numeric: tabular-nums;
}

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

/* ── 이미지별 예측 패널 ─────────────────────────────────────── */
.gel-predict-panel {
  margin-top: 1rem;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  background: var(--surface);
}
.gel-predict-panel--done  { border-color: rgba(76,175,80,0.4); }
.gel-predict-panel--error { border-color: rgba(229,57,53,0.4); }

.gel-predict-panel__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.gel-predict-panel__name {
  font-size: 0.85rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}

.error-text { color: #e53935; }

/* ── 레인 결과 테이블 ──────────────────────────────────────── */
.lane-result-wrap { margin-top: 1.25rem; }

.lane-result-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.lane-result-title { font-size: 0.9rem; font-weight: 600; }

.lane-label-cell { font-weight: 500; font-family: monospace; }

.result-objectives {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.78rem;
  color: #2196f3;
  opacity: 0.85;
}

/* ── 저농도 구간 요약 박스 ───────────────────────────────────── */
.lod-summary {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(33, 150, 243, 0.3);
  border-radius: 8px;
  background: rgba(33, 150, 243, 0.04);
}

.lod-summary__title {
  font-size: 0.82rem;
  font-weight: 600;
  color: #2196f3;
  margin-bottom: 0.6rem;
}

.lod-summary__lanes {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.lod-lane-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.5rem 0.9rem;
  border-radius: 8px;
  border: 1px solid var(--card-border);
  background: var(--surface);
  min-width: 80px;
}
.lod-lane-card--pos { border-color: #4caf50; background: rgba(76,175,80,0.08); }
.lod-lane-card--neg { border-color: #ff9800; background: rgba(255,152,0,0.06); }
.lod-lane-card--missing { opacity: 0.45; }

.lod-lane-card__label {
  font-size: 0.8rem;
  font-weight: 700;
  font-family: monospace;
}
.lod-lane-card__status {
  font-size: 0.75rem;
}
.lod-lane-card--pos .lod-lane-card__status { color: #4caf50; }
.lod-lane-card--neg .lod-lane-card__status { color: #ff9800; }
.lod-lane-card__intensity {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.lod-desc--none { color: #ff9800; }

.lod-badge {
  padding: 0.2rem 0.65rem;
  background: rgba(33, 150, 243, 0.12);
  border: 1px solid #2196f3;
  border-radius: 999px;
  font-size: 0.78rem;
  color: #2196f3;
  font-weight: 600;
}

.lod-desc {
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin-top: 0.5rem;
}

.muted { color: var(--text-secondary); opacity: 0.6; }

.row--muted td { opacity: 0.5; }
.row--low-conc     { border-left: 3px solid #2196f3; }
.row--low-conc-neg { border-left: 3px solid #ff9800; opacity: 0.75; }

/* ── 상태 칩 ────────────────────────────────────────────────── */
.chip {
  display: inline-block;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.chip--green  { background: rgba(76,175,80,0.12);  color: #4caf50; border: 1px solid #4caf50; }
.chip--orange { background: rgba(255,152,0,0.12);  color: #ff9800; border: 1px solid #ff9800; }
.chip--gray   { background: rgba(158,158,158,0.12); color: #9e9e9e; border: 1px solid #9e9e9e; }
.chip--red    { background: rgba(229,57,53,0.12);  color: #e53935; border: 1px solid #e53935; }
</style>
