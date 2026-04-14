<template>
  <header class="app-header">
    <router-link to="/" class="logo">
      <span class="logo__icon">⬡</span>
      Bio Agent
    </router-link>
    <nav class="nav" :class="{ 'nav--open': mobileMenuOpen }">
      <router-link to="/" class="nav__link" :class="{ 'nav__link--active': $route.path === '/' }" @click="mobileMenuOpen = false">
        Home
      </router-link>
    </nav>
    <button type="button" class="hamburger" :class="{ 'hamburger--open': mobileMenuOpen }" @click="mobileMenuOpen = !mobileMenuOpen">
      <span></span><span></span><span></span>
    </button>
  </header>
</template>

<script>
export default {
  name: 'AppHeader',
  data() {
    return {
      mobileMenuOpen: false
    }
  }
}
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: var(--surface);
  border-bottom: 1px solid var(--card-border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--accent);
  letter-spacing: 0.04em;
}

.logo__icon {
  font-size: 1.3rem;
  line-height: 1;
}

.nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.nav__link {
  color: var(--text-secondary);
  font-size: 0.95rem;
  transition: color 0.2s;
}

.nav__link:hover,
.nav__link--active {
  color: var(--accent);
}

.hamburger {
  display: none;
  flex-direction: column;
  gap: 5px;
  padding: 4px;
  background: transparent;
  border: none;
  cursor: pointer;
}

.hamburger span {
  display: block;
  width: 24px;
  height: 2px;
  background: var(--accent);
  transition: transform 0.3s, opacity 0.3s;
}

.hamburger--open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.hamburger--open span:nth-child(2) { opacity: 0; }
.hamburger--open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

@media (max-width: 640px) {
  .hamburger { display: flex; }

  .nav {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    padding: 0.5rem 0;
    background: var(--surface);
    border-bottom: 1px solid var(--card-border);
  }

  .nav--open { display: flex; }

  .nav__link {
    padding: 0.75rem 2rem;
  }
}
</style>
