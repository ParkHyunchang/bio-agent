import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import './assets/css/base/fonts.css'
import './assets/css/base/vars.css'
import './assets/css/base/reset.css'

createApp(App).use(router).mount('#app')
