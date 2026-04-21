<template>
  <div class="home">
    <section class="hero-section">
      <div class="hero__inner">
        <div class="hero__badge">AI-Powered Biology</div>
        <h1 class="hero__title">Bio Agent</h1>
        <p class="hero__subtitle">생명과학 연구를 위한 AI 에이전트 플랫폼</p>
        <p class="hero__desc">
          논문 분석, 유전체 데이터 해석, 신약 후보 탐색까지 —<br>
          바이오 연구의 모든 단계를 AI와 함께.
        </p>
        <div class="hero__status">
          <span v-if="status" class="status-ok">
            <span class="status-dot"></span> 서버 연결됨
          </span>
          <span v-else-if="error" class="status-error">
            <span class="status-dot"></span> 서버 대기 중
          </span>
          <span v-else class="status-loading">
            <span class="status-dot status-dot--pulse"></span> 연결 중...
          </span>
        </div>
      </div>
      <div class="hero__dna" aria-hidden="true">
        <div v-for="i in 12" :key="i" class="dna-bar" :style="{ animationDelay: `${i * 0.15}s` }"></div>
      </div>
    </section>

    <section class="features-section">
      <div class="features__inner">
        <div class="feature-card">
          <div class="feature-card__icon">🧬</div>
          <h3 class="feature-card__title">유전체 분석</h3>
          <p class="feature-card__desc">VCF, FASTQ 데이터 파이프라인 자동화 및 변이 해석</p>
        </div>
        <div class="feature-card">
          <div class="feature-card__icon">📄</div>
          <h3 class="feature-card__title">논문 리뷰</h3>
          <p class="feature-card__desc">PubMed/bioRxiv 논문 요약 및 가설 생성 지원</p>
        </div>
        <div class="feature-card">
          <div class="feature-card__icon">💊</div>
          <h3 class="feature-card__title">신약 탐색</h3>
          <p class="feature-card__desc">ChEMBL, DrugBank 기반 후보물질 및 재창출 분석</p>
        </div>
        <div class="feature-card">
          <div class="feature-card__icon">🔬</div>
          <h3 class="feature-card__title">단백질 분석</h3>
          <p class="feature-card__desc">UniProt, PDB 쿼리 및 AlphaFold 결과 해석 보조</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/axios'

const status = ref(null)
const error = ref(null)

onMounted(() => {
  api.get('/health')
    .then(res => { status.value = res.data?.status || 'ok' })
    .catch(() => { error.value = true })
})
</script>

<style scoped>
@import '@/assets/css/views/home.css';
</style>
