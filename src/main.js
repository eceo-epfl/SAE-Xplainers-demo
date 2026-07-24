import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'vuetify/styles' 
import { createVuetify } from 'vuetify'
import '@mdi/font/css/materialdesignicons.css';
import 'leaflet/dist/leaflet.css'
import GeoMap from "./components/GeoMap.vue"


import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

const vuetify = createVuetify({
  components,
  directives,
})

import App from './App.vue'

createApp(App)
  .use(createPinia())
  .use(vuetify)
  .mount('#app')
