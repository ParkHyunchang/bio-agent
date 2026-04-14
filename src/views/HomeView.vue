<template>
  <div class="home">
    <!-- Hero -->
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

    <!-- Feature Cards -->
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

<script>
import axios from '@/axios'

export default {
  name: 'HomeView',
  data() {
    return { status: null, error: null }
  },
  mounted() {
    axios.get('/health')
      .then((res) => { this.status = res.data?.status || 'ok' })
      .catch(() => { this.error = true })
  }
}
</script>

<style scoped>
/* ===== Hero ===== */
.hero-section {
  min-height: calc(100vh - 60px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  position: relative;
  overflow: hidden;
}

.hero__inner {
  text-align: center;
  max-width: 640px;
  position: relative;
  z-index: 1;
}

.hero__badge {
  display: inline-block;
  padding: 0.3rem 0.9rem;
  border: 1px solid var(--card-border-strong);
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--accent);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 1.5rem;
  background: var(--accent-dim);
}

.hero__title {
  font-family: "Montserrat", sans-serif;
  font-size: clamp(3.5rem, 12vw, 6rem);
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.06em;
  margin-bottom: 0.75rem;
  line-height: 1.1;
}

.hero__subtitle {
  font-size: clamp(1.1rem, 2.5vw, 1.4rem);
  color: var(--text-secondary);
  margin-bottom: 1rem;
  font-weight: 300;
}

.hero__desc {
  font-size: 0.95rem;
  color: var(--text-muted);
  margin-bottom: 2.5rem;
  line-height: 1.8;
}

.hero__status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.2rem;
  border-radius: 6px;
  font-size: 0.85rem;
  border: 1px solid var(--card-border);
  background: var(--surface-2);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-ok { color: var(--accent); }
.status-ok .status-dot { background: var(--accent); }

.status-error { color: var(--text-muted); }
.status-error .status-dot { background: var(--text-muted); }

.status-loading { color: var(--text-secondary); }
.status-dot--pulse {
  background: var(--accent);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}

/* ===== DNA decoration ===== */
.hero__dna {
  position: absolute;
  right: 6%;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 6px;
  align-items: flex-end;
  opacity: 0.18;
  pointer-events: none;
}

.dna-bar {
  width: 4px;
  border-radius: 2px;
  background: var(--accent);
  animation: dnaWave 2s ease-in-out infinite alternate;
}

.dna-bar:nth-child(odd)  { height: 40px; }
.dna-bar:nth-child(even) { height: 24px; }

@keyframes dnaWave {
  from { transform: scaleY(1); }
  to   { transform: scaleY(2.2); }
}

/* ===== Features ===== */
.features-section {
  padding: 4rem 2rem 6rem;
  background: var(--surface);
}

.features__inner {
  max-width: 960px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.feature-card {
  padding: 2rem 1.5rem;
  background: var(--surface-2);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  transition: border-color 0.25s, transform 0.25s;
}

.feature-card:hover {
  border-color: var(--card-border-strong);
  transform: translateY(-4px);
}

.feature-card__icon {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.feature-card__title {
  font-family: "Montserrat", sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.feature-card__desc {
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.6;
}

@media (max-width: 640px) {
  .hero__dna { display: none; }
  .features__inner { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 400px) {
  .features__inner { grid-template-columns: 1fr; }
}
</style>
