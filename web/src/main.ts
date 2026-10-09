import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import '@fontsource/google-sans-code'
import '@fontsource/google-sans-code/500.css'
import '@fontsource/google-sans-code/600.css'
import '@fontsource/google-sans-code/700.css'
import './assets/index.css'
import { initializePwa } from './composables/usePwa'

initializePwa()

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
