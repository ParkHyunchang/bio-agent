<template>
  <aside class="results-panel">
    <div class="results-toolbar">
      <label class="filter-field">
        <span class="filter-field__label">정렬</span>
        <select v-model="sort" class="filter-field__select" :disabled="isSearching">
          <option value="relevance">관련도순</option>
          <option value="pubDate">최신 발행순</option>
          <option value="epubDate">온라인 공개순</option>
        </select>
      </label>

      <label class="filter-field">
        <span class="filter-field__label">유형</span>
        <select v-model="pubType" class="filter-field__select" :disabled="isSearching">
          <option value="">전체</option>
          <option value="Review">Review</option>
          <option value="Systematic Review">Systematic Review</option>
          <option value="Meta-Analysis">Meta-Analysis</option>
          <option value="Clinical Trial">Clinical Trial</option>
          <option value="Randomized Controlled Trial">RCT</option>
          <option value="Case Reports">Case Reports</option>
        </select>
      </label>

      <label class="filter-field" title="발행연도 범위 (예: 2020 - 2025)">
        <span class="filter-field__label">연도</span>
        <input
          v-model.number="yearFrom"
          class="filter-field__year"
          type="number"
          placeholder="From"
          min="1900"
          max="2100"
          :disabled="isSearching"
        />
        <span class="filter-field__sep">–</span>
        <input
          v-model.number="yearTo"
          class="filter-field__year"
          type="number"
          placeholder="To"
          min="1900"
          max="2100"
          :disabled="isSearching"
        />
      </label>

      <label class="filter-check" title="PMC(PubMed Central) 오픈액세스 본문이 있는 논문만 표시">
        <input type="checkbox" v-model="onlyPmc" :disabled="isSearching" />
        <span>PMC만</span>
      </label>
    </div>

    <div v-if="!hasSearched && !isSearching" class="panel-empty">
      <div class="panel-empty__icon">📄</div>
      <p>검색어를 입력하면<br>PubMed 논문이 나타납니다</p>
      <div class="suggestion-chips" aria-label="추천 검색어">
        <button
          v-for="kw in SUGGESTED_KEYWORDS"
          :key="kw"
          type="button"
          class="suggestion-chips__chip"
          @click="onSuggest(kw)"
        >{{ kw }}</button>
      </div>
    </div>

    <div v-else-if="isSearching" class="panel-loading">
      <div class="spinner spinner--lg"></div>
      <p>PubMed 검색 중...</p>
    </div>

    <div v-else-if="papers.length === 0" class="panel-empty">
      <div class="panel-empty__icon">🔎</div>
      <p>검색 결과가 없습니다</p>
    </div>

    <template v-else>
      <div v-if="correctedQuery" class="spell-correction">
        <span>'{{ originalQuery }}'를 '<strong>{{ correctedQuery }}</strong>'로 자동 교정하여 검색했습니다.</span>
      </div>

      <div v-if="tooBroad" class="broad-warning">
        <span class="broad-warning__icon">⚠</span>
        <span>검색어가 너무 광범위합니다. 더 구체적으로 입력해 주세요.</span>
      </div>

      <div class="results-header">
        <span class="results-count">총 {{ total.toLocaleString() }}건</span>
        <span class="results-page">{{ currentPage }} / {{ totalPages }}페이지</span>
      </div>

      <ul
        id="paper-result-list"
        class="paper-list"
        role="listbox"
        aria-label="검색 결과"
      >
        <li
          v-for="(paper, idx) in papers"
          :id="`paper-item-${paper.pmid}`"
          :key="paper.pmid"
          class="paper-item"
          role="option"
          :aria-selected="selectedPmid === paper.pmid && !selectedHistoryId"
          :class="{
            'paper-item--active': selectedPmid === paper.pmid && !selectedHistoryId,
            'paper-item--focused': focusedIndex === idx && selectedPmid !== paper.pmid,
            'paper-item--reviewed': reviewedPmids.has(paper.pmid)
          }"
          @click="selectPaper(paper.pmid)"
        >
          <p class="paper-item__title">
            <span v-if="reviewedPmids.has(paper.pmid)" class="paper-item__check" title="이미 리뷰한 논문">✓</span>
            <span v-html="highlight(paper.title)"></span>
          </p>
          <p class="paper-item__meta">{{ formatAuthors(paper.authors) }}</p>
          <p class="paper-item__journal">
            <span v-html="highlight(paper.journal)"></span> · {{ paper.pubDate }}
          </p>
          <div class="paper-item__tags" v-if="paper.hasPmc || (paper.pubTypes && paper.pubTypes.length)">
            <span v-if="paper.hasPmc" class="tag tag--pmc">PMC</span>
            <span
              v-for="t in (paper.pubTypes || []).filter(t => t !== 'Journal Article')"
              :key="t"
              class="tag"
            >{{ t }}</span>
          </div>
        </li>
      </ul>

      <div class="pagination">
        <button class="pg-btn" @click="goToPage(1)" :disabled="currentPage <= 1">«</button>
        <button class="pg-btn" @click="goToPage(currentPage - 1)" :disabled="currentPage <= 1">‹</button>
        <button
          v-for="p in pageNumbers"
          :key="p"
          class="pg-btn pg-btn--num"
          :class="{ 'pg-btn--active': p === currentPage }"
          @click="goToPage(p)"
        >{{ p }}</button>
        <button class="pg-btn" @click="goToPage(currentPage + 1)" :disabled="currentPage >= totalPages">›</button>
        <button class="pg-btn" @click="goToPage(totalPages)" :disabled="currentPage >= totalPages">»</button>
      </div>
    </template>
  </aside>
</template>

<script setup>
import { injectPaperSearch } from '@/composables/usePaperSearch'
import { highlightQuery } from '@/utils/markdown'

const SUGGESTED_KEYWORDS = ['BRCA2', 'CRISPR-Cas9', 'Alzheimer', 'mRNA vaccine', 'mecA MRSA']

const {
  query, isSearching, hasSearched, papers, total,
  currentPage, tooBroad, correctedQuery, originalQuery,
  sort, pubType, onlyPmc, yearFrom, yearTo,
  selectedPmid, selectedHistoryId, reviewedPmids,
  focusedIndex,
  totalPages, pageNumbers,
  search, goToPage, selectPaper, pushRecentSearch,
  formatAuthors,
} = injectPaperSearch()

function highlight(text) {
  return highlightQuery(text, originalQuery.value || query.value)
}

function onSuggest(kw) {
  query.value = kw
  pushRecentSearch(kw)
  search()
}
</script>
