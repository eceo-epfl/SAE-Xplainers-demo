<template>
  <div class="canvas-wrapper">
<v-toolbar class="flex-wrap align-center px-1" style="position: sticky; top: 0; z-index: 10;">
  <v-toolbar-title></v-toolbar-title>

<span class="v-toolbar-title">
  UMAP Options
</span>
  <v-select
    v-model="data_source"
    :items="Object.keys(datasets)"
    label="Dataset"
    variant="filled"
    density="compact"
    hide-details
    class="mr-2"
    style="max-width: 180px;"
  />

  <v-select
    v-model="color_metric"
    :items="[
      { title: 'Event selectivity', value: 'event_score' },
      { title: 'Event purity', value: 'event_purity' }
    ]"
    label="Point color"
    variant="filled"
    density="compact"
    hide-details
    class="mr-2"
    style="max-width: 200px;"
  />

<v-select
  v-if="data_source === 'ClimateNet Evaluation Set'"
  v-model="selectedClass"
  :items="classItems"
  label="Event type"
  variant="filled"
  density="compact"
  hide-details
  class="mr-2"
  style="max-width: 200px;"
/>

<v-text-field
  v-else-if="data_source === 'SeasFire Evaluation Set'"
  model-value="Fire"
  label="Event type"
  variant="filled"
  density="compact"
  hide-details
  readonly
  class="mr-2"
  style="max-width: 200px;"
/>




  <v-text-field
    v-model="selected_id"
    label="Feature ID"
    placeholder="Enter feature ID"
    variant="filled"
    density="compact"
    hide-details
    style="max-width: 180px;"
  />

  <v-spacer />
</v-toolbar>


<div ref="chartContainer" class="chart-container"></div>

<v-card class="mt-2 pa-4 explanation-card">

  <v-card-title class="section-title">
    Understanding the visualization
  </v-card-title>

  <v-card-text class="section-text">
    This interactive visualization presents a 2D UMAP projection of features extracted from a GeoTopK trained on ClimaX finetuned for extreme events tasks. Each point represents a feature, i.e. a learned direction in the high-dimensional embedding space.  

    UMAP preserves local distances, so points close together correspond to similar features in the original high-dimensional space.
    Global distances should be interpreted cautiously as dimensionality reduction distorts some relationships.
  </v-card-text>

  <v-divider class="my-4"></v-divider>

  <v-card-title class="section-title">
    How to read the visualization
  </v-card-title>

  <v-row dense class="mt-2">

    <v-col cols="12" sm="6">
      <div class="legend-item legend-indent">
        <div class="legend-title">● Point size</div>
        <div class="legend-text">
          Proportional to how frequently a feature activates.
        </div>
      </div>
    </v-col>

    <v-col cols="12" sm="6">
      <div class="legend-item legend-indent">
        <div class="legend-title">🎨 Point color</div>
        <div class="legend-text" v-if="color_metric === 'event_score'">
          Colors use a nonlinear grey-to-red scale emphasizing high positive fire selectivity.<br>
              <code>
                Event selectivity = (S_event − S_no-event) / (S_event + S_no-event)
              </code>
              <div></div>
              where:
              <ul class="pl-8">
                <li>
                  S_event: total feature activation over event samples.
                </li>
                <li>
                  S_no-event: total feature activation over non-event samples.
                </li>
              </ul>
        </div>
        <div class="legend-text" v-else>
          Color encodes event purity rescaled with min-max normalization.<br>
          <code>purity = #(Activations on event samples) / #(Activations on non-event samples)</code>
        </div>

      <div class="colorbar-wrapper" v-if="color_metric === 'event_score'">
        <div class="colorbar-continuous" :style="{ background: fireGradient }"></div>

        <div class="colorbar-labels">
          <span>−1</span>
          <span>0</span>
          <span>1</span>
        </div>

        <div class="colorbar-caption">
          {{ data_source === 'SeasFire Evaluation Set'
              ? 'Fire Selectivity'
              : `${classLabels[selectedClass]} Selectivity`
          }}
        </div>
      </div>

      <div class="colorbar-wrapper" v-else>
        <div class="colorbar-purity" :style="{ background: purityGradient }"></div>

        <div class="colorbar-labels">
          <span>0</span>
          <span>0.5</span>
          <span>1</span>
        </div>

        <div class="colorbar-caption">
          {{ data_source === 'SeasFire Evaluation Set'
              ? 'Fire Purity'
              : `${classLabels[selectedClass]} Purity`
          }}
        </div>
      </div>

    </div>

    </v-col>

    <v-col cols="12" sm="6">
      <div class="legend-item legend-indent">
        <div class="legend-title">🔗 Connections</div>
        <div class="legend-text">
          Thickness of the lines between points show how strongly features co-occur, up to the 10 most co-occurring features.
        </div>
      </div>
    </v-col>

  </v-row>

  <v-divider class="my-4"></v-divider>

<v-card-title class="section-title">
  Predictors involved in the rules
</v-card-title>



  <v-card-text class="section-text">
    <ul class="pl-6">
  <v-row dense>
    <v-col cols="12" sm="4" v-for="(item, idx) in variables" :key="idx">
      <div class="rule-var">
        <li><span class="var-name">{{ item.name }}</span>: 
        <span class="var-desc">{{ item.desc }}</span>
        </li>
      </div>
    </v-col>
  </v-row>
  </ul>
</v-card-text>
<v-card-text class="section-text">
  <b>Sources:</b> ERA-5, MODIS, GPWv4, CAM5.1
  <div></div>
  <b>Disclaimers:</b>
<ul class="pl-5">
  <li>
     Longitude and latitude, as well as U850 and V850 for the ClimateNet dataset, can be negative values. Other negative values should be interpreted as NaN values.
  </li>
  <li>
    This demo contains non-spatial rules only.
  </li>
  <li>
    Feature IDs range from 0 to 4095. The ones without any learned rules, due to not enough active samples, have been filtered out in this demo.
  </li>
</ul>
  </v-card-text>
</v-card>
</div>

</template>

<script setup>
import { ref, onMounted, watch, computed } from "vue"
import * as d3 from "d3"
import seasfire_json from "@/assets/umap_seasfire.json"
import climatenet_json from "@/assets/umap_climatenet.json"

const chartContainer = ref(null)
const emit = defineEmits(["select-point", "points-ready", "max-coocs-ready", "dataset-changed", "color-metric-changed"])


let canvas, context
let xBaseScale, yBaseScale
let xScale, yScale
let zoomTransform = d3.zoomIdentity

let WIDTH
let HEIGHT
const MIN_SIZE = 2.5
const MAX_SIZE = 20   

const color_metric = ref("event_score")

const selectedClass = ref(1)

const classLabels = {
    1: "Tropical cyclone",
    2: "Atmospheric river"
}

const classItems = computed(() =>
  Object.entries(classLabels).map(([value, title]) => ({
    value: Number(value),
    title
  }))
)



const seasfireVariables = [
  { name: 'lst_day', desc: 'Land Surface Temperature (Day) (K)' },
  { name: 'mslp', desc: 'Mean Sea Level Pressure (Pa)' },
  { name: 'ndvi', desc: 'Normalized Difference Vegetation Index (unitless)' },
  { name: 'pop_dens', desc: 'Population Density (persons/km²)' },
  { name: 'rel_hum', desc: 'Relative Humidity (%)' },
  { name: 'ssrd', desc: 'Surface Solar Radiation Downwards (MJ/m²)' },
  { name: 'sst', desc: 'Sea Surface Temperature (K)' },
  { name: 'swvl1', desc: 'Volumetric Soil Water Layer 1 (unitless)' },
  { name: 't2m_mean', desc: '2m Temperature Mean (K)' },
  { name: 'tp', desc: 'Total Precipitation (m)' },
  { name: 'vpd', desc: 'Vapor Pressure Deficit (hPa)' },
  { name: 'ws10', desc: 'Wind Speed at 10m (m/s)' },
  { name: 'lat', desc: 'Latitude (degrees)' },
  { name: 'lon', desc: 'Longitude (degrees)' },
]

const climatenetVariables = [
  { name: 'TMQ', desc: 'Total Vertically Integrated Precipitable Water (kg/m²)' },
  { name: 'U850', desc: 'Zonal Wind at 850 mbar (m/s)' },
  { name: 'V850', desc: 'Meridional Wind at 850 mbar (m/s)' },
  { name: 'PSL', desc: 'Sea Level Pressure (Pa)' },
  { name: 'lat', desc: 'Latitude (degrees)'},
  { name: 'lon', desc: 'Longitude (degrees)'},
]


const variables = computed(() => {
  return data_source.value === 'ClimateNet Evaluation Set'
    ? climatenetVariables
    : seasfireVariables
})

const hoveredPointId = ref(null)
const selected_id = ref(null)
const data_source = ref('SeasFire Evaluation Set')

const props = defineProps({
  selectedId: Number
})

const datasets = {
  'SeasFire Evaluation Set': seasfire_json,
  'ClimateNet Evaluation Set': climatenet_json,
}

const activePointId = computed(() =>
  hoveredPointId.value ?? props.selectedId
)

const points = computed(() => datasets[data_source.value].points)


watch(color_metric, (val) => {
  emit("color-metric-changed", val)
  drawPoints()
})

watch(color_metric, () => {
  drawPoints()
})


watch(data_source, () => {
  hoveredPointId.value = null
  if (!context) return
  setupScales()
  drawPoints()

  emit("points-ready", points.value)
  emit("max-coocs-ready", datasets[data_source.value].max_value_cooccurences)
  emit("dataset-changed", data_source.value)
})

watch(selected_id, (newId) => {
  if (!newId || !context) return

  const point = points.value.find(
    p => p.id.toString() === newId.toString()
  )

  if (point) {
    emit("select-point", point) 
  }
})

watch(() => props.selectedId, id => {
  if (!context) return

  hoveredPointId.value = null 
  drawPoints()
})


function setupScales() {
  const PADDING_RATIO = 0.02
  const padX = WIDTH * PADDING_RATIO
  const padY = HEIGHT * PADDING_RATIO

  xBaseScale = d3.scaleLinear()
    .domain(d3.extent(points.value, d => d.x))
    .range([padX, WIDTH - padX])

  yBaseScale = d3.scaleLinear()
    .domain(d3.extent(points.value, d => d.y))
    .range([HEIGHT - padY, padY])

  xScale = zoomTransform.rescaleX(xBaseScale)
  yScale = zoomTransform.rescaleY(yBaseScale)
}

function setupZoom() {
  const zoom = d3.zoom()
    .scaleExtent([0.5, 20])
    .translateExtent([[0, 0], [WIDTH, HEIGHT]])
    .extent([[0, 0], [WIDTH, HEIGHT]])
    .on("zoom", (event) => {
      zoomTransform = event.transform
      xScale = zoomTransform.rescaleX(xBaseScale)
      yScale = zoomTransform.rescaleY(yBaseScale)
      drawPoints()
    })

  d3.select(canvas).call(zoom)
}

function getSelectivity(p) {
  if (data_source.value === 'SeasFire Evaluation Set') {
    return p[`class_selectivity_1`]
  } else {
    return p[`class_selectivity_${selectedClass.value}`]
  }
}

function getPurity(p) {
  if (data_source.value === 'SeasFire Evaluation Set') {
    return p[`class_purity_1`]
  } else {
    return p[`class_purity_${selectedClass.value}`]
  }
}


function drawPoints() {
  if (!context) return

  context.clearRect(0, 0, WIDTH, HEIGHT)

  drawConnections()

  points.value.forEach(p => {
    const x = xScale(p.x)
    const y = yScale(p.y)
    const baseRadius = MIN_SIZE + (p.m_occurences) * (MAX_SIZE - MIN_SIZE)
    const isHovered = hoveredPointId.value === p.id
    const isActive = activePointId.value === p.id


    context.beginPath()
    context.arc(x, y, isActive ? baseRadius + 2 : baseRadius, 0, 2 * Math.PI)
    let color

    if (color_metric.value === "event_score") {
      color = valueToColor(getSelectivity(p), fireColorScale)
    } else {
      color = valueToColor(getPurity(p), purityColorScale)
    }


    context.fillStyle = color

    context.globalAlpha = isActive ? 1 : .99
    context.fill()

    if (isActive) {
      context.strokeStyle = "#fff"
      context.lineWidth = 1.5
      context.stroke()
    }
  })

  context.globalAlpha = 1
}

const pointIndex = computed(() => {
  const m = new Map()
  points.value.forEach(p => m.set(Number(p.id), p)) 
  return m
})

function drawConnections() {
  const activeId = activePointId.value
  if (activeId == null) return

  const source = pointIndex.value.get(Number(activeId))
  if (!source || !source.cooccurences) return

  const x1 = xScale(source.x)
  const y1 = yScale(source.y)

  Object.entries(source.cooccurences).forEach(([targetId, weight]) => {
    const target = pointIndex.value.get(Number(targetId))
    if (!target) return

    const x2 = xScale(target.x)
    const y2 = yScale(target.y)

    context.beginPath()
    context.moveTo(x1, y1)
    context.lineTo(x2, y2)

    context.strokeStyle = "#00ff66"
    context.shadowColor = "#00ff66"
    const w = Number(weight)

    context.lineWidth = 1 + w * 10 
    context.globalAlpha = 1
    context.stroke()
  })

}


function handleHover(event) {
  if (!context) return

  const rect = canvas.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top

  let foundId = null
  points.value.forEach(p => {
    const x = xScale(p.x)
    const y = yScale(p.y)
    const radius = MIN_SIZE + p.m_occurences * (MAX_SIZE - MIN_SIZE)
    if (Math.hypot(x - mouseX, y - mouseY) < radius) {
      foundId = p.id
    }
  })

  if (foundId !== hoveredPointId.value) {
    hoveredPointId.value = foundId
    drawPoints()
  }
}

function handleClick(event) {
  if (!context) return

  const rect = canvas.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top

  let closest = null
  let minDist = Infinity

  points.value.forEach(p => {
    const x = xScale(p.x)
    const y = yScale(p.y)
    const r = MIN_SIZE + p.m_occurences * (MAX_SIZE - MIN_SIZE)
    const d = Math.hypot(x - mouseX, y - mouseY)
    if (d < r && d < minDist) {
      closest = p
      minDist = d
    }
  })

  if (closest) {
    hoveredPointId.value = null
    drawPoints()
    emit("select-point", closest)
  }
}

onMounted(() => {
  const rect = chartContainer.value.getBoundingClientRect()
  WIDTH = rect.width
  HEIGHT = rect.height

  canvas = d3
    .select(chartContainer.value)
    .append("canvas")
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .node()

  context = canvas.getContext("2d")

  setupScales()
  setupZoom()
  drawPoints()
  canvas.addEventListener("mousemove", handleHover)
  canvas.addEventListener("mouseleave", () => {
    hoveredPointId.value = null
    drawPoints()
  })
  canvas.addEventListener("click", handleClick)

  drawPoints()
  emit("points-ready", points.value)
  emit("max-coocs-ready", datasets[data_source.value].max_value_cooccurences)
})

function isInvalid(v) {
  return v === 5 || !Number.isFinite(v)
}

function valueToColor(v, scaleFn) {
  if (isInvalid(v)) return "#cccccc"
  return scaleFn(v)
}

const fireGradient = computed(() => {
  const steps = 100
  const colors = []

  for (let i = 0; i <= steps; i++) {
    const v = -1 + (i / steps) * 2 
    const color = fireColorScaleLegend(v)
    colors.push(`${color} ${i}%`)
  }

  return `linear-gradient(to right, ${colors.join(", ")})`
})

const purityGradient = computed(() => {
  const steps = 100
  const colors = []

  for (let i = 0; i <= steps; i++) {
    const v = i / steps 
    const color = purityColorScale(v)
    colors.push(`${color} ${i}%`)
  }

  return `linear-gradient(to right, ${colors.join(", ")})`
})


const fireScale = d3.scalePow() 
  .domain([-1, -0.1, 0, 0.5, 1])
  .exponent(.5)
  .range(["#2166ac", 'pink', "#ff0000"])
  // .range(["#d9d9d9", "#e0a6a6", "pink", "#ff6b6b", "#ff0000"]) 
  .interpolate(d3.interpolateRgb)

function fireColorScale(v) {
  v = Math.max(-1, Math.min(1, v))
  const baseColor = d3.color(fireScale(v)) 
  const alpha = 0.25 + 0.75 * ((v + 1) / 2)      
  baseColor.opacity = alpha
  return baseColor.formatRgb()                   
}

function fireColorScaleLegend(v) {
  v = Math.max(-1, Math.min(1, v))
  const baseColor = d3.color(fireScale(v)) 
  const alpha = 0.6 + 0.4 * ((v + 1) / 2)  
  baseColor.opacity = alpha 
  return baseColor.formatRgb()                   
}

const purityScale = d3.scaleLinear()
  .domain([0, 1])
  .range(["#d9d9d9", "#ff0000"]) 
  .interpolate(d3.interpolateRgb)


function purityColorScale(v) {
  v = Math.max(0, Math.min(1, v))
  const baseColor = d3.color(purityScale(v)) 
  const alpha = 0.25 + 0.75 * v      
  baseColor.opacity = alpha
  return baseColor.formatRgb()                   
}


</script>


<style scoped>
.chart-container {
  width: 1200px;
  height: 700px;
  border: 1px solid #ccc;
  margin: auto;
}
.v-toolbar > * {
  margin-bottom: 4px;
}

.section-title {
  font-size: 0.95rem;
  font-weight: 600;
  padding-bottom: 0;
}

.legend-indent {
  margin-left: 20px;
}

.legend-item {
  margin-bottom: 14px;
}

.legend-title {
  font-weight: 600;
  font-size: 0.92rem;
  margin-bottom: 4px;
}

.legend-text {
  font-size: 0.85rem;
  opacity: 0.8;
  line-height: 1.4;
}


.colorbar-caption {
  font-size: 0.75rem;
  opacity: 0.65;
  text-align: center; 
}

.colorbar-wrapper {
  width: 180px;
  margin: 8px auto;
}


.colorbar-continuous {
  height: 8px;
  width: 100%;
  border-radius: 4px;
  border: 1px solid #ccc;
}

.colorbar-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  opacity: 0.7;
  margin-top: 2px;
  width: 100%;
}

.colorbar-purity {
  height: 8px;
  width: 100%;
  border-radius: 4px;
  border: 1px solid #ccc;
}


.rule-var {
  margin-bottom: 8px;
}

.var-name {
  font-weight: 600;
  color: #2c3e50;
}

.var-desc {
  color: #555;
  font-size: 0.875rem;
}

</style>
