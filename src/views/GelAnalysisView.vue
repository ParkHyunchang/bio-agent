<template>
  <div class="gel-analysis">

    <div class="tab-bar">
      <button class="tab-btn" :class="{ 'tab-btn--active': activeTab === 'train' }" @click="activeTab = 'train'">
        학습 데이터 관리
      </button>
      <button class="tab-btn" :class="{ 'tab-btn--active': activeTab === 'agent' }" @click="activeTab = 'agent'">
        AI 에이전트
      </button>
      <button class="tab-btn" :class="{ 'tab-btn--active': activeTab === 'predict' }" @click="activeTab = 'predict'">
        Ct값 예측
      </button>

      <div class="model-badge" :class="modelStatus.trained ? 'model-badge--ok' : 'model-badge--none'">
        <span v-if="modelStatus.trained">
          {{ modelStatus.model_type }} · R²{{ modelStatus.cv_r2_mean }} · {{ modelStatus.sample_count }}개
        </span>
        <span v-else>모델 미학습</span>
      </div>
    </div>

    <GelTrainTab v-if="activeTab === 'train'" @model-updated="refreshModelStatus" />
    <GelPredictTab v-if="activeTab === 'predict'" :model-status="modelStatus" @records-changed="refreshModelStatus" />
    <GelAgentTab v-if="activeTab === 'agent'" />

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import GelTrainTab from '@/components/gel/GelTrainTab.vue'
import GelPredictTab from '@/components/gel/GelPredictTab.vue'
import GelAgentTab from '@/components/gel/GelAgentTab.vue'
import { fetchModelStatus } from '@/services/gel.service'

const activeTab = ref('train')
const modelStatus = ref({ trained: false })

async function refreshModelStatus() {
  try {
    modelStatus.value = await fetchModelStatus()
  } catch {
    modelStatus.value = { trained: false }
  }
}

onMounted(refreshModelStatus)
</script>

<style scoped>
@import '@/assets/css/gel/view.css';
</style>
