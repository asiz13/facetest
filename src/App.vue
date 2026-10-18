<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Dices,
  Download,
  Eye,
  MoveHorizontal,
  MoveVertical,
  Palette,
  RotateCcw,
  ScanFace,
  Scaling,
  Sparkles,
  Undo2
} from 'lucide-vue-next'
import {
  hsvToRgb,
  recolorBlush,
  recolorEyes,
  recolorHair,
  recolorNose,
  recolorSkin,
  removeWhiteBackdrop
} from './imageProcessing'

const assetModules = import.meta.glob(
  '../{behindhair,clothes,eyebrow,eyes,fonthair,head,mouths,noses,shy}/*.{png,PNG,jpg,JPG,jpeg,JPEG}',
  { eager: true, query: '?url', import: 'default' }
)

const partDefinitions = [
  { key: 'fonthair', label: '\u524d\u53d1', kind: 'hair' },
  { key: 'eyebrow', label: '\u7709\u6bdb', kind: 'hair' },
  { key: 'eyes', label: '\u773c\u775b', kind: 'eyes' },
  { key: 'noses', label: '\u9f3b\u5b50', kind: 'nose' },
  { key: 'mouths', label: '\u5634\u578b', kind: 'plain' },
  { key: 'shy', label: '\u9762\u9970', kind: 'blush' },
  { key: 'head', label: '\u8138\u578b', kind: 'skin' },
  { key: 'behindhair', label: '\u540e\u53d1', kind: 'hair' }
]
const singlePartDefinitions = partDefinitions

const assetBuckets = {}

for (const [path, url] of Object.entries(assetModules)) {
  const match = path.match(/\/([^/]+)\/([^/]+)$/)
  if (!match) continue
  const [, folder, file] = match
  if (!assetBuckets[folder]) assetBuckets[folder] = []

  const numeric = file.match(/\d+/)
  assetBuckets[folder].push({
    file,
    url,
    removeWhiteBackground: /\.(?:jpe?g)$/i.test(file),
    previewUrl: /\.(?:png)$/i.test(file)
      ? `${import.meta.env.BASE_URL}previews-webp/${file.replace(/\.[^.]+$/, '.webp')}`
      : null,
    order: numeric ? Number(numeric[0]) : Number.MAX_SAFE_INTEGER
  })
}

for (const assets of Object.values(assetBuckets)) {
  assets.sort((a, b) => a.order - b.order || a.file.localeCompare(b.file))
}

const selected = reactive({
  fonthair: 0,
  eyebrow: 0,
  eyes: 0,
  noses: 0,
  mouths: 0,
  shy: 0,
  head: 0,
  behindhair: 0
})

function defaultPartState(key) {
  return {
    enabled: true,
    visible: key === 'shy',
    offsetX: 0,
    offsetY: 0,
    scale: 100,
    spacing: 0,
    closeMode: 'reset'
  }
}

const partState = reactive(
  Object.fromEntries(
    partDefinitions.map((definition) => [
      definition.key,
      Array.from(
        { length: assetBuckets[definition.key]?.length ?? 0 },
        () => defaultPartState(definition.key)
      )
    ])
  )
)

const selectedPartState = computed(() =>
  Object.fromEntries(
    partDefinitions.map((definition) => [
      definition.key,
      partState[definition.key]?.[selected[definition.key]] ??
        defaultPartState(definition.key)
    ])
  )
)

const clothes1 = computed(
  () => assetBuckets.clothes?.find((item) => item.file.toLowerCase() === '1.png') ?? assetBuckets.clothes?.[0]
)
const clothes2 = computed(
  () => assetBuckets.clothes?.find((item) => item.file.toLowerCase() === '2.png') ?? assetBuckets.clothes?.[1]
)

const hair = reactive({ h: 243, s: 100, v: 31 })
const eyes = reactive({ h: 2, s: 100, v: 100 })
const blush = reactive({ h: 342, s: 48, v: 88 })
const skin = reactive({ tone: 0, h: 30, s: 9, v: 100, r: 255, g: 243, b: 231 })
const colorTab = ref('hair')
const randomHistory = ref([])

const skinScaleMarks = [0, 25, 50, 75, 100]
const hairPalettes = [
  { h: 246, s: 88, v: 42 },
  { h: 338, s: 69, v: 67 },
  { h: 18, s: 73, v: 45 },
  { h: 43, s: 61, v: 82 },
  { h: 164, s: 58, v: 51 },
  { h: 206, s: 73, v: 59 },
  { h: 275, s: 64, v: 64 },
  { h: 222, s: 12, v: 73 },
  { h: 4, s: 81, v: 35 }
]
const blushPalettes = [
  { label: '\u7c89', h: 340, s: 46, v: 94 },
  { label: '\u7ea2', h: 356, s: 54, v: 88 },
  { label: '\u6a59', h: 18, s: 56, v: 92 }
]

const hairRgb = computed(() => hsvToRgb(hair.h, hair.s / 100, hair.v / 100))
const eyesRgb = computed(() => hsvToRgb(eyes.h, eyes.s / 100, eyes.v / 100))
const blushRgb = computed(() => hsvToRgb(blush.h, blush.s / 100, blush.v / 100))
const skinRgb = computed(() => ({ r: skin.r, g: skin.g, b: skin.b }))
const hairCss = computed(() => `rgb(${hairRgb.value.r} ${hairRgb.value.g} ${hairRgb.value.b})`)
const eyesCss = computed(() => `rgb(${eyesRgb.value.r} ${eyesRgb.value.g} ${eyesRgb.value.b})`)
const blushCss = computed(() => `rgb(${blushRgb.value.r} ${blushRgb.value.g} ${blushRgb.value.b})`)
const skinCss = computed(() => `rgb(${skinRgb.value.r} ${skinRgb.value.g} ${skinRgb.value.b})`)
const skinGradient = computed(() => `linear-gradient(90deg, rgb(255 243 231), rgb(240 213 190))`)
const blushHueValue = computed(() => (blush.h < 335 ? blush.h + 360 : blush.h))

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function mix(start, end, amount) {
  return Math.round(start + (end - start) * amount)
}

function skinAtTone(value) {
  const amount = clampNumber(Number(value), 0, 100) / 100
  return {
    tone: Math.round(amount * 100),
    h: mix(30, 28, amount),
    s: mix(9, 21, amount),
    v: mix(100, 94, amount),
    r: mix(255, 240, amount),
    g: mix(243, 213, amount),
    b: mix(231, 190, amount)
  }
}

function colorStyle(color) {
  const rgb = hsvToRgb(color.h, color.s / 100, color.v / 100)
  return `rgb(${rgb.r} ${rgb.g} ${rgb.b})`
}

function setSkinTone(value) {
  Object.assign(skin, skinAtTone(value))
}

function setBlushHue(value) {
  blush.h = ((Number(value) % 360) + 360) % 360
}

function applyBlushPalette(palette) {
  Object.assign(blush, { h: palette.h, s: palette.s, v: palette.v })
}

const activeAssets = computed(() =>
  Object.fromEntries(
    singlePartDefinitions.map((definition) => [
      definition.key,
      assetBuckets[definition.key]?.[selected[definition.key]]
    ])
  )
)

const renderSignature = computed(() =>
  JSON.stringify({
    selected: { ...selected },
    parts: Object.fromEntries(
      partDefinitions.map((definition) => [
        definition.key,
        partState[definition.key].map((state) => ({ ...state }))
      ])
    ),
    hair: { h: hair.h, s: hair.s, v: hair.v },
    eyes: { h: eyes.h, s: eyes.s, v: eyes.v },
    blush: { h: blush.h, s: blush.s, v: blush.v },
    skin: { tone: skin.tone, h: skin.h, s: skin.s, v: skin.v, r: skin.r, g: skin.g, b: skin.b }
  })
)

const canvasRef = ref(null)
const miniCanvasRef = ref(null)
const isRendering = ref(true)
const isExporting = ref(false)
const exportWidth = 1301
const exportHeight = 1479
const isCompactViewport = window.matchMedia('(max-width: 620px)').matches
const previewScale = isCompactViewport ? 0.7 : 0.74
const canvasWidth = Math.round(exportWidth * previewScale)
const canvasHeight = Math.round(exportHeight * previewScale)
const layerCacheBudget = (isCompactViewport ? 44 : 72) * 1024 * 1024
const imageCacheLimit = isCompactViewport ? 12 : 24
const imagePromises = new Map()
const layerCache = new Map()
const normalizedImageCache = new Map()
let layerCacheBytes = 0
let renderToken = 0
let renderTimer = 0

function loadImage(url) {
  if (!url) return Promise.reject(new Error('Missing image url'))
  if (imagePromises.has(url)) {
    const cached = imagePromises.get(url)
    imagePromises.delete(url)
    imagePromises.set(url, cached)
    return cached
  }

  const promise = new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Unable to load ${url}`))
    image.src = url
  })

  if (imagePromises.size >= imageCacheLimit) {
    imagePromises.delete(imagePromises.keys().next().value)
  }
  imagePromises.set(url, promise)
  promise.catch(() => {
    if (imagePromises.get(url) === promise) imagePromises.delete(url)
  })
  return promise
}

function colorKey(kind, color) {
  if (kind === 'hair') return `${color.h}-${color.s}-${color.v}`
  if (kind === 'eyes') return `${color.h}-${color.s}-${color.v}`
  if (kind === 'blush') return `${color.h}-${color.s}-${color.v}`
  if (kind === 'skin' || kind === 'nose') {
    return `${color.tone}-${color.h}-${color.s}-${color.v}`
  }
  return 'plain'
}

function cacheLayer(cacheKey, canvas) {
  const bytes = canvas.width * canvas.height * 4

  while (layerCache.size && layerCacheBytes + bytes > layerCacheBudget) {
    const oldestKey = layerCache.keys().next().value
    layerCacheBytes -= layerCache.get(oldestKey).bytes
    layerCache.delete(oldestKey)
  }

  layerCache.set(cacheKey, { canvas, bytes })
  layerCacheBytes += bytes
}

function normalizedSource(image, url, width, height) {
  const cacheKey = `${width}x${height}|${url}`
  const cached = normalizedImageCache.get(cacheKey)
  if (cached) {
    normalizedImageCache.delete(cacheKey)
    normalizedImageCache.set(cacheKey, cached)
    return cached
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(image, 0, 0, width, height)
  const imageData = context.getImageData(0, 0, width, height)
  removeWhiteBackdrop(imageData)
  context.putImageData(imageData, 0, 0)

  normalizedImageCache.set(cacheKey, canvas)
  while (normalizedImageCache.size > 2) {
    normalizedImageCache.delete(normalizedImageCache.keys().next().value)
  }
  return canvas
}

async function createLayer(spec, width, height) {
  const cacheKey = `${width}x${height}|${spec.url}|${spec.kind}|${colorKey(spec.kind, spec.color)}`
  const cached = layerCache.get(cacheKey)
  if (cached) {
    layerCache.delete(cacheKey)
    layerCache.set(cacheKey, cached)
    return cached.canvas
  }

  const image = await loadImage(spec.url)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.clearRect(0, 0, width, height)
  const removeBackground =
    spec.removeWhiteBackground ?? /\.(?:jpe?g)(?:[?#]|$)/i.test(spec.url)
  const source = removeBackground
    ? normalizedSource(image, spec.url, width, height)
    : image
  context.drawImage(source, 0, 0, width, height)

  if (spec.kind !== 'plain') {
    const imageData = context.getImageData(0, 0, width, height)
    if (spec.kind === 'hair') {
      recolorHair(imageData, spec.color, { stripWhiteEdge: spec.stripWhiteEdge === true })
    }
    if (spec.kind === 'eyes') {
      recolorEyes(imageData, spec.color, { whiteBlend: spec.whiteBlend ?? 0 })
    }
    if (spec.kind === 'blush') recolorBlush(imageData, spec.color)
    if (spec.kind === 'nose') recolorNose(imageData, spec.color)
    if (spec.kind === 'skin') recolorSkin(imageData, spec.color)
    context.putImageData(imageData, 0, 0)
  }

  cacheLayer(cacheKey, canvas)
  return canvas
}

function partTransform(key, index = selected[key]) {
  const state = partState[key]?.[index] ?? defaultPartState(key)
  const applied = state.enabled || state.closeMode === 'keep'
  return applied
    ? {
        offsetX: state.offsetX,
        offsetY: state.offsetY,
        scale: state.scale / 100,
        scaleX: 1 + state.spacing / 100
      }
    : { offsetX: 0, offsetY: 0, scale: 1, scaleX: 1 }
}

const activeLayers = computed(() => {
  const assets = activeAssets.value
  const accessoryLayers = (assetBuckets.shy ?? [])
    .map((asset, index) =>
      partState.shy[index]?.visible
        ? {
            url: asset.url,
            previewUrl: asset.previewUrl,
            kind: 'blush',
            color: blush,
            ...partTransform('shy', index)
          }
        : null
    )
    .filter(Boolean)

  return [
    {
      url: assets.behindhair?.url,
      previewUrl: assets.behindhair?.previewUrl,
      kind: 'hair',
      color: hair,
      removeWhiteBackground: assets.behindhair?.removeWhiteBackground,
      stripWhiteEdge: true,
      ...partTransform('behindhair')
    },
    { url: clothes2.value?.url, previewUrl: clothes2.value?.previewUrl, kind: 'skin', color: skin },
    {
      url: assets.head?.url,
      previewUrl: assets.head?.previewUrl,
      kind: 'skin',
      color: skin,
      ...partTransform('head')
    },
    ...accessoryLayers,
    { url: clothes1.value?.url, previewUrl: clothes1.value?.previewUrl, kind: 'skin', color: skin },
    {
      url: assets.mouths?.url,
      previewUrl: assets.mouths?.previewUrl,
      kind: 'plain',
      ...partTransform('mouths')
    },
    {
      url: assets.noses?.url,
      previewUrl: assets.noses?.previewUrl,
      kind: 'nose',
      color: skin,
      ...partTransform('noses')
    },
    {
      url: assets.eyebrow?.url,
      previewUrl: assets.eyebrow?.previewUrl,
      kind: 'hair',
      color: hair,
      removeWhiteBackground: assets.eyebrow?.removeWhiteBackground,
      stripWhiteEdge: true,
      ...partTransform('eyebrow')
    },
    {
      url: assets.fonthair?.url,
      previewUrl: assets.fonthair?.previewUrl,
      kind: 'hair',
      color: hair,
      removeWhiteBackground: assets.fonthair?.removeWhiteBackground,
      stripWhiteEdge: true,
      ...partTransform('fonthair')
    },
    {
      url: assets.eyes?.url,
      previewUrl: assets.eyes?.previewUrl,
      kind: 'eyes',
      color: eyes,
      whiteBlend: (skin.tone / 100) * 0.18,
      ...partTransform('eyes')
    }
  ].filter(Boolean)
})

function layerUrl(spec, useOriginal) {
  return useOriginal ? spec.url : spec.previewUrl ?? spec.url
}

async function preloadLayerImages(specs, useOriginal) {
  const urls = [
    ...new Set(specs.map((spec) => layerUrl(spec, useOriginal)).filter(Boolean))
  ]
  await Promise.allSettled(urls.map((url) => loadImage(url)))
}

async function createSceneLayers(specs, width, height, isCancelled, useOriginal = false) {
  await preloadLayerImages(specs, useOriginal)
  const layers = []
  const offsetScaleX = width / exportWidth
  const offsetScaleY = height / exportHeight

  for (const spec of specs) {
    const url = layerUrl(spec, useOriginal)
    if (!url) continue
    if (isCancelled()) return []

    try {
      layers.push({
        canvas: await createLayer({ ...spec, url }, width, height),
        offsetX: (spec.offsetX ?? 0) * offsetScaleX,
        offsetY: (spec.offsetY ?? 0) * offsetScaleY,
        scale: spec.scale ?? 1,
        scaleX: spec.scaleX ?? 1
      })
    } catch {
      if (useOriginal || !spec.previewUrl || spec.previewUrl === spec.url) continue
      try {
        layers.push({
          canvas: await createLayer({ ...spec, url: spec.url }, width, height),
          offsetX: (spec.offsetX ?? 0) * offsetScaleX,
          offsetY: (spec.offsetY ?? 0) * offsetScaleY,
          scale: spec.scale ?? 1,
          scaleX: spec.scaleX ?? 1
        })
      } catch {
        // Keep the remaining scene visible if one optional asset fails to load.
      }
    }
  }

  return layers
}

function drawScene(canvas, layers) {
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, canvas.width, canvas.height)
  for (const layer of layers) {
    if (layer.scale === 1 && layer.scaleX === 1) {
      context.drawImage(layer.canvas, layer.offsetX, layer.offsetY)
      continue
    }
    const width = canvas.width * layer.scale * layer.scaleX
    const height = canvas.height * layer.scale
    context.drawImage(
      layer.canvas,
      (canvas.width - width) / 2 + layer.offsetX,
      (canvas.height - height) / 2 + layer.offsetY,
      width,
      height
    )
  }
}

async function renderScene(token) {
  const canvas = canvasRef.value
  if (!canvas) return

  try {
    const layers = await createSceneLayers(
      [...activeLayers.value],
      canvasWidth,
      canvasHeight,
      () => token !== renderToken
    )

    if (token !== renderToken) return
    drawScene(canvas, layers)
    drawMiniPreview()
  } finally {
    if (token === renderToken) isRendering.value = false
  }
}

function drawMiniPreview() {
  const source = canvasRef.value
  const target = miniCanvasRef.value
  if (!source || !target) return
  const context = target.getContext('2d')
  context.clearRect(0, 0, target.width, target.height)
  context.drawImage(source, 0, 0, target.width, target.height)
}

function scheduleRender() {
  window.clearTimeout(renderTimer)
  const token = ++renderToken
  isRendering.value = true
  renderTimer = window.setTimeout(() => renderScene(token), 30)
}

function changePart(key, delta) {
  const count = assetBuckets[key]?.length ?? 0
  if (!count) return
  selected[key] = (selected[key] + delta + count) % count
}

function setPartEnabled(key, enabled) {
  const state = selectedPartState.value[key]
  state.enabled = enabled
  if (!enabled && state.closeMode === 'reset') resetPartAdjustment(key)
}

function resetPartAdjustment(key) {
  const state = selectedPartState.value[key]
  state.offsetX = 0
  state.offsetY = 0
  state.scale = 100
  state.spacing = 0
}

function resetAllPartAdjustments() {
  for (const definition of partDefinitions) {
    for (const state of partState[definition.key]) {
      state.offsetX = 0
      state.offsetY = 0
      state.scale = 100
      state.spacing = 0
    }
  }
}

function setPartVisible(key, index, visible) {
  const state = partState[key]?.[index]
  if (state) state.visible = visible
}

function nudgePart(key, field, delta) {
  const limits =
    field === 'offsetX'
      ? [-260, 260]
      : field === 'offsetY'
        ? [-220, 220]
        : [-35, 35]
  const state = selectedPartState.value[key]
  state[field] = clampNumber(state[field] + delta, limits[0], limits[1])
}

function signedOffset(value) {
  return `${value > 0 ? '+' : ''}${value}px`
}

function signedPercent(value) {
  return `${value > 0 ? '+' : ''}${value}%`
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function captureScene() {
  return {
    selected: { ...selected },
    parts: Object.fromEntries(
      partDefinitions.map((definition) => [
        definition.key,
        partState[definition.key].map((state) => ({ ...state }))
      ])
    ),
    hair: { ...hair },
    eyes: { ...eyes },
    blush: { ...blush },
    skin: { ...skin }
  }
}

function recordRandomHistory() {
  randomHistory.value = [...randomHistory.value.slice(-19), captureScene()]
}

function restoreScene(snapshot) {
  Object.assign(selected, snapshot.selected)
  for (const definition of partDefinitions) {
    partState[definition.key].forEach((state, index) => {
      Object.assign(state, snapshot.parts[definition.key][index])
    })
  }
  Object.assign(hair, snapshot.hair)
  Object.assign(eyes, snapshot.eyes)
  Object.assign(blush, snapshot.blush)
  Object.assign(skin, snapshot.skin)
}

function undoRandomization() {
  const snapshot = randomHistory.value.pop()
  if (snapshot) restoreScene(snapshot)
}

function applyRandomParts() {
  resetAllPartAdjustments()
  const nextSelection = {}
  for (const definition of singlePartDefinitions) {
    const count = assetBuckets[definition.key]?.length ?? 0
    nextSelection[definition.key] = count > 0 ? Math.floor(Math.random() * count) : 0
  }
  Object.assign(selected, nextSelection)
  for (const state of partState.shy) state.visible = false
  if (partState.shy.length) {
    partState.shy[selected.shy].visible = true
  }
}

function randomizeParts() {
  recordRandomHistory()
  applyRandomParts()
}

function applyRandomColors() {
  const nextHair = randomItem(hairPalettes)
  Object.assign(hair, nextHair)

  const harmony = Math.random() < 0.35 ? 180 : randomItem([0, 28, -28, 52, -52])
  Object.assign(eyes, {
    h: (nextHair.h + harmony + 360) % 360,
    s: 78 + Math.round(Math.random() * 22),
    v: 78 + Math.round(Math.random() * 22)
  })
  Object.assign(blush, randomItem(blushPalettes))

  setSkinTone(Math.round(Math.random() * 100))
}

function randomizeColors() {
  recordRandomHistory()
  applyRandomColors()
}

function randomizeScene() {
  recordRandomHistory()
  applyRandomParts()
  applyRandomColors()
}

function resetScene() {
  randomHistory.value = []
  Object.assign(selected, {
    fonthair: 0,
    eyebrow: 0,
    eyes: 0,
    noses: 0,
    mouths: 0,
    shy: 0,
    head: 0,
    behindhair: 0
  })
  for (const definition of partDefinitions) {
    for (const state of partState[definition.key]) {
      Object.assign(state, defaultPartState(definition.key))
    }
  }
  Object.assign(hair, { h: 243, s: 100, v: 31 })
  Object.assign(eyes, { h: 2, s: 100, v: 100 })
  Object.assign(blush, { h: 342, s: 48, v: 88 })
  setSkinTone(0)
}

function exportImage() {
  if (isExporting.value) return
  isExporting.value = true
  const specs = activeLayers.value.map((spec) => ({
    ...spec,
    color: spec.color ? { ...spec.color } : undefined
  }))

  void (async () => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = exportWidth
      canvas.height = exportHeight
      const layers = await createSceneLayers(
        specs,
        exportWidth,
        exportHeight,
        () => false,
        true
      )
      drawScene(canvas, layers)
      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/png')
      })
      if (!blob) return
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'face-maker.png'
      link.click()
      URL.revokeObjectURL(link.href)
    } finally {
      isExporting.value = false
    }
  })()
}

watch(renderSignature, scheduleRender)

onMounted(async () => {
  await nextTick()
  scheduleRender()
})

onBeforeUnmount(() => {
  window.clearTimeout(renderTimer)
  renderToken += 1
})
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand-block">
        <span class="brand-mark"><Sparkles :size="21" /></span>
        <div>
          <p class="section-kicker">CHARACTER DRESSING STUDIO</p>
          <h1>&#25423;&#33080;&#24037;&#22346;</h1>
        </div>
      </div>

      <div class="header-actions">
        <button class="primary-button" type="button" title="&#38543;&#26426;&#21305;&#37197;" @click="randomizeScene">
          <Dices :size="17" />
          &#20840;&#37096;&#38543;&#26426;
        </button>
        <button
          class="secondary-button"
          type="button"
          title="&#25764;&#38144;&#19978;&#19968;&#27425;&#38543;&#26426;"
          :disabled="randomHistory.length === 0"
          @click="undoRandomization"
        >
          <Undo2 :size="17" />
          &#25764;&#38144;
        </button>
        <button class="secondary-button" type="button" title="&#38543;&#26426;&#39068;&#33394;" @click="randomizeColors">
          <Palette :size="17" />
          &#38543;&#26426;&#39068;&#33394;
        </button>
        <button class="secondary-button" type="button" title="&#38543;&#26426;&#37096;&#20214;" @click="randomizeParts">
          <ScanFace :size="17" />
          &#38543;&#26426;&#37096;&#20214;
        </button>
        <button class="secondary-button" type="button" title="&#37325;&#32622;" @click="resetScene">
          <RotateCcw :size="17" />
          &#37325;&#32622;
        </button>
        <button
          class="secondary-button"
          type="button"
          title="&#23548;&#20986; PNG"
          :disabled="isExporting"
          :aria-busy="isExporting"
          @click="exportImage"
        >
          <Download :size="17" />
          &#23548;&#20986;
        </button>
      </div>
    </header>

    <main class="workspace">
      <section class="preview-panel">
        <div class="preview-meta">
          <div>
            <span class="preview-label">&#23454;&#26102;&#30011;&#24067;</span>
            <strong>
              &#39044;&#35272; {{ canvasWidth }} x {{ canvasHeight }} /
              &#23548;&#20986; {{ exportWidth }} x {{ exportHeight }}
            </strong>
          </div>
          <div class="layer-tags" aria-label="&#22270;&#23618;&#39034;&#24207;">
            <span>&#30524;&#30555;</span>
            <span>&#21069;&#21457;</span>
            <span>&#30473;&#27611;</span>
            <span>&#40763;&#23376;</span>
            <span>&#22068;&#22411;</span>
            <span>&#34915;&#39280;&#21069;&#23618;</span>
            <span>&#38754;&#39280;</span>
            <span>&#33080;&#22411;</span>
            <span>&#34915;&#39280;&#21518;&#23618;</span>
            <span>&#21518;&#21457;</span>
          </div>
        </div>
        <div class="canvas-frame">
          <canvas
            ref="canvasRef"
            :width="canvasWidth"
            :height="canvasHeight"
            :aria-busy="isRendering"
          ></canvas>
        </div>
      </section>

      <aside class="sidebar">
        <section class="control-section">
          <div class="section-title">
            <ScanFace :size="18" />
            <h2>&#37096;&#20214;&#20999;&#25442;&#19982;&#35843;&#25972;</h2>
          </div>

          <div class="part-list">
            <div
              v-for="definition in partDefinitions"
              :key="definition.key"
              class="part-row"
            >
              <div class="part-select-column">
                <div class="part-select-head">
                  <div class="part-name">
                    <span>{{ definition.label }}</span>
                    <strong>
                      {{ String(selected[definition.key] + 1).padStart(2, '0') }}
                      <small>/ {{ String(assetBuckets[definition.key]?.length ?? 0).padStart(2, '0') }}</small>
                    </strong>
                  </div>
                  <div class="part-actions">
                    <button
                      type="button"
                      title="&#19978;&#19968;&#20010;"
                      @click="changePart(definition.key, -1)"
                    >
                      <ChevronLeft :size="16" />
                    </button>
                    <button
                      type="button"
                      title="&#19979;&#19968;&#20010;"
                      @click="changePart(definition.key, 1)"
                    >
                      <ChevronRight :size="16" />
                    </button>
                  </div>
                </div>

                <label
                  v-for="(asset, index) in definition.key === 'shy' ? assetBuckets.shy : []"
                  :key="asset.file"
                  class="part-use-toggle"
                  :title="`${definition.label} ${String(index + 1).padStart(2, '0')}`"
                >
                  <input
                    type="checkbox"
                    :checked="partState.shy[index].visible"
                    :aria-label="`${definition.label} ${index + 1}\u4f7f\u7528`"
                    @change="setPartVisible(definition.key, index, $event.target.checked)"
                  />
                  <span>{{ String(index + 1).padStart(2, '0') }}</span>
                </label>
              </div>

              <div class="part-adjust-column">
                <div class="part-adjust-head">
                  <label class="part-toggle">
                    <input
                      type="checkbox"
                      :checked="selectedPartState[definition.key].enabled"
                      :aria-label="`${definition.label}\u542f\u7528`"
                      @change="setPartEnabled(definition.key, $event.target.checked)"
                    />
                    <span>&#21551;&#29992;</span>
                  </label>
                  <button
                    class="adjust-reset"
                    type="button"
                    title="&#37325;&#32622;&#35843;&#25972;"
                    :aria-label="`${definition.label}\u91cd\u7f6e\u8c03\u6574`"
                    @click="resetPartAdjustment(definition.key)"
                  >
                    <RotateCcw :size="13" />
                  </button>
                </div>

                <div v-if="selectedPartState[definition.key].enabled" class="adjust-controls">
                  <div class="adjust-field">
                    <span>
                      <Scaling :size="13" />
                      &#22823;&#23567;
                    </span>
                    <output>{{ selectedPartState[definition.key].scale }}%</output>
                    <input
                      v-model.number="selectedPartState[definition.key].scale"
                      type="range"
                      min="50"
                      max="150"
                      step="1"
                      :aria-label="`${definition.label}\u5927\u5c0f`"
                    />
                  </div>
                  <div class="adjust-field">
                    <span>
                      <MoveHorizontal :size="13" />
                      &#24038;&#21491;&#20301;&#32622;
                    </span>
                    <output>{{ signedOffset(selectedPartState[definition.key].offsetX) }}</output>
                    <input
                      v-model.number="selectedPartState[definition.key].offsetX"
                      type="range"
                      min="-260"
                      max="260"
                      step="1"
                      :aria-label="`${definition.label}\u5de6\u53f3\u4f4d\u7f6e`"
                    />
                    <div class="adjust-nudge">
                      <button
                        type="button"
                        :aria-label="`${definition.label}\u5411\u5de6\u5fae\u8c03`"
                        title="&#21521;&#24038;&#24494;&#35843; 1px"
                        @click="nudgePart(definition.key, 'offsetX', -1)"
                      ><ArrowLeft :size="14" /></button>
                      <button
                        type="button"
                        :aria-label="`${definition.label}\u5411\u53f3\u5fae\u8c03`"
                        title="&#21521;&#21491;&#24494;&#35843; 1px"
                        @click="nudgePart(definition.key, 'offsetX', 1)"
                      ><ArrowRight :size="14" /></button>
                    </div>
                  </div>
                  <div class="adjust-field">
                    <span>
                      <MoveVertical :size="13" />
                      &#19978;&#19979;&#20301;&#32622;
                    </span>
                    <output>{{ signedOffset(selectedPartState[definition.key].offsetY) }}</output>
                    <input
                      v-model.number="selectedPartState[definition.key].offsetY"
                      type="range"
                      min="-220"
                      max="220"
                      step="1"
                      :aria-label="`${definition.label}\u4e0a\u4e0b\u4f4d\u7f6e`"
                    />
                    <div class="adjust-nudge">
                      <button
                        type="button"
                        :aria-label="`${definition.label}\u5411\u4e0a\u5fae\u8c03`"
                        title="&#21521;&#19978;&#24494;&#35843; 1px"
                        @click="nudgePart(definition.key, 'offsetY', -1)"
                      ><ArrowUp :size="14" /></button>
                      <button
                        type="button"
                        :aria-label="`${definition.label} Down`"
                        title="&#21521;&#19979;&#24494;&#35843; 1px"
                        @click="nudgePart(definition.key, 'offsetY', 1)"
                      ><ArrowDown :size="14" /></button>
                    </div>
                  </div>
                  <div class="adjust-field">
                    <span>
                      <MoveHorizontal :size="13" />
                      &#38388;&#36317;
                    </span>
                    <output>{{ signedPercent(selectedPartState[definition.key].spacing) }}</output>
                    <input
                      v-model.number="selectedPartState[definition.key].spacing"
                      type="range"
                      min="-35"
                      max="35"
                      step="1"
                      :aria-label="`${definition.label}\u95f4\u8ddd`"
                    />
                  </div>
                  <div class="close-policy">
                    <span>&#20851;&#38381;&#26102;</span>
                    <label>
                      <input
                        v-model="selectedPartState[definition.key].closeMode"
                        type="radio"
                        :name="`close-mode-${definition.key}`"
                        value="reset"
                      />
                      &#36824;&#21407;
                    </label>
                    <label>
                      <input
                        v-model="selectedPartState[definition.key].closeMode"
                        type="radio"
                        :name="`close-mode-${definition.key}`"
                        value="keep"
                      />
                      &#27839;&#29992;
                    </label>
                  </div>
                </div>
                <div v-else class="part-closed">
                  <span v-if="selectedPartState[definition.key].closeMode === 'keep'">
                    &#35843;&#25972;&#27839;&#29992;
                    {{ selectedPartState[definition.key].scale }}% ·
                    X{{ signedOffset(selectedPartState[definition.key].offsetX) }} ·
                    Y{{ signedOffset(selectedPartState[definition.key].offsetY) }} ·
                    &#38388;&#36317;{{ signedPercent(selectedPartState[definition.key].spacing) }}
                  </span>
                  <span v-else>&#35843;&#25972;&#24050;&#36824;&#21407;</span>
                </div>
              </div>
            </div>
          </div>

        </section>

        <section class="control-section color-section">
          <div class="section-title">
            <Palette :size="18" />
            <h2>&#39068;&#33394;&#35843;&#25972;</h2>
          </div>

          <div class="color-workbench">
            <div class="mini-preview-shell">
              <canvas ref="miniCanvasRef" width="260" height="296"></canvas>
              <span>LIVE</span>
            </div>

            <div class="color-workbench-main">
              <div class="segmented-control">
                <button type="button" :class="{ active: colorTab === 'hair' }" @click="colorTab = 'hair'">
                  <Palette :size="15" />
                  &#22836;&#21457;
                </button>
                <button type="button" :class="{ active: colorTab === 'eyes' }" @click="colorTab = 'eyes'">
                  <Eye :size="15" />
                  &#30524;&#30555;
                </button>
                <button type="button" :class="{ active: colorTab === 'blush' }" @click="colorTab = 'blush'">
                  <Sparkles :size="15" />
                  &#38754;&#39280;
                </button>
                <button type="button" :class="{ active: colorTab === 'skin' }" @click="colorTab = 'skin'">
                  <ScanFace :size="15" />
                  &#32932;&#33394;
                </button>
              </div>

              <div v-if="colorTab === 'hair'" class="color-panel">
                <div class="color-summary">
                  <span class="color-swatch" :style="{ background: hairCss }"></span>
                  <div>
                    <span>HSB</span>
                    <strong>H{{ hair.h }} S{{ hair.s }} B{{ hair.v }}</strong>
                  </div>
                </div>

                <div class="tune-list">
                  <label class="tune-row slider-row">
                    <span>&#33394;&#30456;</span>
                    <input v-model.number="hair.h" class="hue-slider" type="range" min="0" max="359" />
                    <output>{{ hair.h }}</output>
                  </label>
                  <label class="tune-row slider-row">
                    <span>&#39281;&#21644;&#24230;</span>
                    <input v-model.number="hair.s" type="range" min="0" max="100" />
                    <output>{{ hair.s }}</output>
                  </label>
                  <label class="tune-row slider-row">
                    <span>&#26126;&#26263;</span>
                    <input v-model.number="hair.v" type="range" min="0" max="100" />
                    <output>{{ hair.v }}</output>
                  </label>
                </div>
              </div>

              <div v-if="colorTab === 'eyes'" class="color-panel">
                <div class="color-summary">
                  <span class="color-swatch" :style="{ background: eyesCss }"></span>
                  <div>
                    <span>HSB</span>
                    <strong>H{{ eyes.h }} S{{ eyes.s }} B{{ eyes.v }}</strong>
                  </div>
                </div>

                <div class="tune-list">
                  <label class="tune-row slider-row">
                    <span>&#33394;&#30456;</span>
                    <input v-model.number="eyes.h" class="hue-slider" type="range" min="0" max="359" />
                    <output>{{ eyes.h }}</output>
                  </label>
                  <label class="tune-row slider-row">
                    <span>&#39281;&#21644;&#24230;</span>
                    <input v-model.number="eyes.s" type="range" min="0" max="100" />
                    <output>{{ eyes.s }}</output>
                  </label>
                  <label class="tune-row slider-row">
                    <span>&#26126;&#26263;</span>
                    <input v-model.number="eyes.v" type="range" min="0" max="100" />
                    <output>{{ eyes.v }}</output>
                  </label>
                </div>
              </div>

              <div v-if="colorTab === 'blush'" class="color-panel">
                <div class="color-summary">
                  <span class="color-swatch" :style="{ background: blushCss }"></span>
                  <div>
                    <span>HSB</span>
                    <strong>H{{ blush.h }} S{{ blush.s }} B{{ blush.v }}</strong>
                  </div>
                </div>

                <div class="blush-presets">
                  <button
                    v-for="palette in blushPalettes"
                    :key="palette.label"
                    type="button"
                    :style="{ background: colorStyle(palette) }"
                    @click="applyBlushPalette(palette)"
                  >{{ palette.label }}</button>
                </div>

                <div class="tune-list">
                  <label class="tune-row slider-row">
                    <span>&#33394;&#30456;</span>
                    <input
                      class="hue-slider blush-hue-slider"
                      type="range"
                      min="335"
                      max="395"
                      step="1"
                      :value="blushHueValue"
                      @input="setBlushHue($event.target.value)"
                    />
                    <output>{{ blush.h }}</output>
                  </label>
                  <label class="tune-row slider-row">
                    <span>&#39281;&#21644;&#24230;</span>
                    <input v-model.number="blush.s" type="range" min="25" max="65" />
                    <output>{{ blush.s }}</output>
                  </label>
                  <label class="tune-row slider-row">
                    <span>&#26126;&#26263;</span>
                    <input v-model.number="blush.v" type="range" min="55" max="95" />
                    <output>{{ blush.v }}</output>
                  </label>
                </div>
              </div>

              <div v-if="colorTab === 'skin'" class="color-panel">
                <div class="color-summary">
                  <span class="color-swatch" :style="{ background: skinCss }"></span>
                  <div>
                    <span>HSB + RGB</span>
                    <strong>H{{ skin.h }} S{{ skin.s }} B{{ skin.v }}</strong>
                    <small>R{{ skin.r }} G{{ skin.g }} B{{ skin.b }}</small>
                  </div>
                </div>

                <div class="skin-range">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    :value="skin.tone"
                    :style="{ background: skinGradient }"
                    @input="setSkinTone($event.target.value)"
                  />
                  <div class="skin-range-labels">
                    <span>&#20559;&#30333;</span>
                    <span>&#20559;&#28145;</span>
                  </div>
                </div>

                <div class="skin-marks">
                  <button
                    v-for="tone in skinScaleMarks"
                    :key="tone"
                    type="button"
                    :style="{ background: colorStyle(skinAtTone(tone)) }"
                    @click="setSkinTone(tone)"
                  >{{ tone }}</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </main>
  </div>
</template>
