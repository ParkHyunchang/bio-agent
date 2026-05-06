<template>
  <div class="search-bar">
    <div class="search-bar__inner">
      <span class="search-bar__icon">🔍</span>
      <input
        v-model="query"
        ref="searchInputEl"
        class="search-bar__input"
        type="text"
        :placeholder="`논문 검색 (${shortcutHint})`"
        :title="'논문 키워드, 저자, 저널을 입력해 PubMed에서 검색합니다 — ' + shortcutHint"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="paper-result-list"
        :aria-activedescendant="focusedIndex >= 0 && papers[focusedIndex] ? `paper-item-${papers[focusedIndex].pmid}` : undefined"
        :aria-expanded="recentSearchesOpen"
        @keyup.enter="onEnter"
        @focus="recentSearchesOpen = true"
        @blur="onBlur"
      />
      <button
        v-if="query"
        class="search-bar__clear"
        @click="clearSearch"
        title="검색어 지우기 (Esc)"
      >×</button>
      <button class="search-bar__btn" :disabled="isSearching || !query.trim()" @click="search">
        <span v-if="isSearching" class="spinner"></span>
        <span v-else>검색</span>
      </button>

      <ul
        v-if="recentSearchesOpen && recentSearches.length > 0"
        class="recent-searches"
        role="listbox"
        aria-label="최근 검색어"
        @mousedown.prevent
      >
        <li class="recent-searches__head">
          <span>최근 검색어</span>
          <button
            type="button"
            class="recent-searches__clear"
            @click="onClearRecent"
          >전체 지우기</button>
        </li>
        <li
          v-for="(item, idx) in recentSearches"
          :key="item"
          class="recent-searches__item"
          role="option"
          :aria-selected="false"
          :data-idx="idx"
          @click="useRecent(item)"
        >
          <span class="recent-searches__icon">🕒</span>
          <span class="recent-searches__text">{{ item }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { injectPaperSearch } from '@/composables/usePaperSearch'

const ctx = injectPaperSearch()
const {
  query, isSearching, papers, focusedIndex,
  recentSearches, search, pushRecentSearch, clearRecentSearches,
} = ctx
const searchInputEl = ctx.searchInputEl

const recentSearchesOpen = ref(false)
const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || '')
const shortcutHint = computed(() => isMac ? '⌘K로 빠르게 포커스' : '/ 키로 빠르게 포커스')

// 부모(PaperReviewView)의 글로벌 keydown 핸들러가 dropdown 닫기를 호출할 수 있도록 노출
defineExpose({
  closeRecent: () => { recentSearchesOpen.value = false },
  isRecentOpen: () => recentSearchesOpen.value,
})

function onEnter() {
  recentSearchesOpen.value = false
  search()
}

function onBlur() {
  setTimeout(() => { recentSearchesOpen.value = false }, 120)
}

function clearSearch() {
  query.value = ''
  searchInputEl.value?.focus()
}

function useRecent(item) {
  query.value = item
  recentSearchesOpen.value = false
  pushRecentSearch(item)
  search()
}

function onClearRecent() {
  clearRecentSearches()
  recentSearchesOpen.value = false
}
</script>
