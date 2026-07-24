<template>
  <v-app>
    <div class="app-layout">
      <div class="canvas-container">
        <Canvas 
          :selected-id="selectedPointId"
          @select-point="onSelectPoint" 
          @points-ready="points = $event" 
          @max-coocs-ready="maxCoocs = $event"
          @dataset-changed="handleDatasetChange"
          @color-metric-changed="currentColorMetric = $event"
        />
      </div>

      <v-navigation-drawer
        v-model="drawer"
        location="end"
        temporary
        floating
        width="400"
        elevation="16"
        class="drawer-custom"
        :scrim="false"
      >
        <v-toolbar flat>
          <v-toolbar-title class="drawer-title">Feature Description</v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="closeDrawer">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        
        <v-divider />

        <v-card v-if="selectedPoint" class="pa-3">
          <p><b>ID:</b> {{ selectedPoint.id }}</p>

          <p><b>Evaluation set mean activation:</b>
            {{ selectedPoint[`class_selectivity_1`] === 5
                ? 'NaN'
                : selectedPoint.energy.toExponential(2) }}
          </p>

          <p><b>Evaluation set accuracy:</b>
            {{ selectedPoint[`class_selectivity_1`] === 5
                ? 'NaN'
                : selectedPoint.acc_val.toFixed(2) }}
          </p>


            <div v-if="currentColorMetric === 'event_score'">
              <p><b>Selectivity:</b></p>
              <ul class="pl-5 text-grey">
                <li v-for="cls in classes" :key="'sel-' + cls">
                  <b>{{ classLabels[currentDataset][cls] }}:</b>
                  {{
                    selectedPoint[`class_selectivity_${cls}`] === 5
                      ? 'NaN'
                      : selectedPoint[`class_selectivity_${cls}`].toFixed(2)
                  }} ({{selectedPoint[`no_events_${cls}`].toFixed(0)}} events)
                </li>
              </ul>
            </div>


            <div v-else>
              <p><b>Purity:</b></p>
              <ul class="pl-5 text-grey">
                <li v-for="cls in classes" :key="'pur-' + cls">
                  <b>{{ classLabels[currentDataset][cls] }}:</b>
                  {{
                    selectedPoint[`class_purity_${cls}`] === 5
                      ? 'NaN'
                      : selectedPoint[`class_purity_${cls}`].toFixed(2)
                  }}
                </li>
              </ul>
            </div>
           <v-divider class="my-3" />

<p>
  <b>
    {{ selectedPoint.rules.length }}
    {{ selectedPoint.source }}
    rules ({{ selectedPoint.complexity_level }} complexity):
  </b>
</p>

<div class="rules-container">

  <template v-for="(rule, idx) in parsedRules" :key="idx">

    <div class="rule-block">
      <p class="rule-title">
        Rule {{ idx + 1 }}
        (Weight: {{ rule.ruleWeight }}, Coverage: {{ rule.ruleCoverage }})
      </p>

<ul class="conditions-list">
  <li
    v-for="(cond, j) in rule.conditions"
    :key="j"
  >
    {{ cond }}
    <span v-if="j < rule.conditions.length - 1" class="logic-and">
      &
    </span>
  </li>
</ul>

    </div>

    <div
      v-if="idx < parsedRules.length - 1"
      class="logic-or"
    >
      OR
    </div>

  </template>

</div>



          <v-divider class="my-3" />

          <p><b>Top 3 co-occurrences:</b></p>
          <ul class="pl-5" v-if="topCoocs.length">
            <li v-for="cooc in topCoocs" :key="cooc.id">
              <v-btn
                variant="text"
                size="small"
                @click="selectCooc(cooc.id)"
              >
                ID {{ cooc.id }}
              </v-btn>
              — {{ (cooc.weight * maxCoocs).toFixed(0)}} co-occurences 
            </li>
          </ul>

          <v-divider class="my-3" />

          <div v-if="geoData">
            <p><b>Geographic activations ({{ geoData.activations.length }} localizations):</b></p>

            <GeoMap
              :activations="geoData.activations"
              :max-value="geoData.maxValue"
            />

            <div class="colorbar-caption">
              Occurences count
            </div>
          </div>

        </v-card>
      </v-navigation-drawer>
    </div>
  </v-app>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue"
import Canvas from "./components/Canvas.vue"
import GeoMap from "./components/GeoMap.vue"

const drawer = ref(false)
const selectedPoint = ref(null)
const selectedPointId = ref(null)
const geoData = ref(null)
const geoLoading = ref(false)
const points = ref([])  
const maxCoocs = ref(1)  
const currentDataset = ref("SeasFire Evaluation Set")
const BASE_URL = import.meta.env.BASE_URL

const classLabels = {
  "SeasFire Evaluation Set":
    {
    1: "Fire",
    },
  "ClimateNet Evaluation Set":
    {
    1: "Tropical cyclone",
    2: "Atmospheric river"
    },
}

const currentColorMetric = ref("event_score")

const classes = computed(() =>
  Object.keys(classLabels[currentDataset.value]).map(Number)
)

const parsedRules = computed(() => {
  if (!selectedPoint.value?.rules) return []

  return selectedPoint.value.rules.map((ruleString) => {
    const parts = ruleString.split(" and ")

    let ruleWeight = null
    let ruleCoverage = null
    const conditions = []

    parts.forEach(p => {
      const trimmed = p.trim()

      if (trimmed.startsWith("Rule Weight:")) {
        ruleWeight = trimmed.replace("Rule Weight:", "").trim()
      } else if (trimmed.startsWith("Rule Coverage:")) {
        ruleCoverage = trimmed.replace("Rule Coverage:", "").trim()
      } else {
        conditions.push(trimmed)
      }
    })

    return {
      ruleWeight,
      ruleCoverage,
      conditions
    }
  })
})


const GEO_PATHS = {
  "ClimateNet Evaluation Set": "geoactivations_climatenet_count.json.gz",
  "SeasFire Evaluation Set": "geoactivations_seasfire_count.json.gz"
}

const geoAll = ref({})
const geoMaxValue = ref(1)

async function readGzipJson(res) {
  const encoding = res.headers.get("content-encoding")

  if (encoding === "gzip") {
    return res.json()
  }

  const stream = res.body.pipeThrough(
    new DecompressionStream("gzip")
  )

  return new Response(stream).json()
}

async function loadGeoForDataset(dataset) {
  const path = GEO_PATHS[dataset]
  if (!path) return

  try {
    const res = await fetch(`${BASE_URL}${path}`)

    if (!res.ok) {
      throw new Error(`HTTP error: ${res.status}`)
    }

    const payload = await readGzipJson(res)

    geoMaxValue.value = Number(payload.max_value)
    geoAll.value = payload.points
  } catch (error) {
    console.error("Failed to load geographic data:", error)
  }
}



onMounted(async () => {
  await loadGeoForDataset(currentDataset.value)
})

watch(currentDataset, async (newDs) => {
  await loadGeoForDataset(newDs)
})

watch([selectedPoint, geoAll, geoMaxValue], ([pt, geo, max]) => {
  if (!pt || !geo || !geo[pt.id]) {
    geoData.value = null
    return
  }
  geoData.value = {
    activations: geo[pt.id],
    maxValue: Number.isFinite(max) && max > 0 ? max : 1
  }
})



function closeDrawer() {
  drawer.value = false
  selectedPoint.value = null
  selectedPointId.value = null  
}

function handleDatasetChange(ds) {
  currentDataset.value = ds
  closeDrawer()
}



const topCoocs = computed(() => {
  if (!selectedPoint.value?.cooccurences) return []

  return Object.entries(selectedPoint.value.cooccurences)
    .map(([id, weight]) => ({
      id: Number(id),
      weight
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
})


function selectCooc(id) {
  const point = points.value.find(p => Number(p.id) === Number(id))
  if (!point) return
  onSelectPoint(point)  
}

function onSelectPoint(point) {
  selectedPoint.value = point
  selectedPointId.value = point.id   
  drawer.value = true
}
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;   
}

.canvas-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start; 
  overflow-y: auto;        
  padding: 10px;
}


.drawer-custom {
  background-color: #f0f0f0; 
}

.drawer-title {
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
  flex: 0 0 auto;
}

.colorbar-caption {
  font-size: 0.75rem;
  opacity: 0.65;
  text-align: center;  
}

.rules-container {
  margin-top: 4px;
  margin-left: 20px;    
}

.rule-block {
  margin-bottom: 0px;
}

.rule-title {
  font-weight: 600;
  margin-bottom: 0px;
}

.conditions-list {
  list-style: disc;  
  padding-left: 22px;  
  margin: 0;
  color: #666;
  font-size: 1rem;
}

.logic-or {
  text-align: center;
  font-weight: 800;
  margin: 0px 0;
  opacity: 0.7;
}

.logic-and {
  margin-left: 3px;
  opacity: 0.7;
  font-weight: 800;
}


</style>
