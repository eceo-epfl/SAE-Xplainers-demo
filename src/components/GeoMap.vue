<template>
  <div>
    <div ref="mapEl" class="map"></div>

    <div class="colorbar-container">
      <div class="colorbar" :style="{ background: colorbarGradient }"></div>
      <div class="colorbar-labels">
        <span>1</span>
        <span>{{ maxValue.toFixed(0) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, watch, ref, nextTick } from "vue"
import L from "leaflet"
import "leaflet.heat"
import { computed } from "vue"

const minValue = 0

const props = defineProps({
  activations: {
    type: Array,
    required: true
  },
  maxValue: {
    type: Number,
    default: 1
  }
})

const maxValue = computed(() => (props.maxValue > 0 ? props.maxValue : 1))

const isMapReady = ref(false)
const mapEl = ref(null)
let map = null
let layer = null

function valueToColor(v) {
  if (v === 5 || !Number.isFinite(v)) {
    return "#cccccc"
  }

  const t = Math.min(1, Math.max(0, v / maxValue.value))
  const r = Math.floor(255 * t)
  const g = Math.floor(50 * (1 - t))
  const b = Math.floor(255 * (1 - t))
  return `rgb(${r},${g},${b})`
}


const colorbarGradient = computed(() => {
  const steps = 100
  const colors = []
  for (let i = 0; i <= steps; i++) {
    const v = minValue + (i / steps) * (maxValue.value - minValue)
    colors.push(`${valueToColor(v)} ${Math.floor((i/steps)*100)}%`)
  }
  return `linear-gradient(to right, ${colors.join(", ")})`
})

onMounted(() => {
  map = L.map(mapEl.value, {
    center: [20, 0],
    zoom: 1,
    worldCopyJump: true
  })

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map)

  isMapReady.value = true
})

watch(
  () => [props.activations, isMapReady.value],
  async ([data, ready]) => {
    if (!ready || !data) return

    await nextTick()
    map.invalidateSize()

    if (layer) layer.remove()

    const heatData = data
      .filter(a => Number.isFinite(a.value))
      .map(a => [
        a.lat,
        a.lon,
        Math.min(1, a.value / maxValue.value) 
      ])
    layer = L.heatLayer(heatData, {
      radius: 7,       
      blur: 2,        
      maxZoom: 5,
      max: 1, 
      gradient: {
        0.0: "rgb(0,50,255)",
        1: "rgb(255,0,0)"
      }
    })
    layer.addTo(map)
  },
  { immediate: true }
)


    


onUnmounted(() => {
  map?.remove()
})
</script>

<style scoped>
.map {
  height: 300px;
  width: 100%;
  border-radius: 8px;
}

.colorbar-container {
  margin-top: 8px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.colorbar {
  height: 12px;
  width: 100%;
  border-radius: 4px;
  background: red;
}

.colorbar-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-top: 2px;
}

</style>
