const EYE_SHADOW_START_PAIR = ['IMG_0722.PNG', 'IMG_0763.PNG']
const FIXED_COLOR_ACCESSORY_FILES = new Set(['IMG_0609.PNG'])

const BLUSH_HUES = [340, 354, 18, 28]

function normalizedFileKey(file) {
  return file.trim().toLowerCase()
}

function numericFileOrder(first, second) {
  const firstNumber = Number(first.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER)
  const secondNumber = Number(second.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER)
  return firstNumber - secondNumber || first.localeCompare(second)
}

export function buildEyeShadowBindings(eyeFiles, shadowFiles) {
  const orderedEyes = [...eyeFiles].sort(numericFileOrder)
  const orderedShadows = [...shadowFiles].sort(numericFileOrder)
  const bindings = new Map()
  const [startEye, startShadow] = EYE_SHADOW_START_PAIR
  const eyeStartIndex = orderedEyes.findIndex(
    (file) => normalizedFileKey(file) === normalizedFileKey(startEye)
  )
  const shadowStartIndex = orderedShadows.findIndex(
    (file) => normalizedFileKey(file) === normalizedFileKey(startShadow)
  )
  const eyeOffset = eyeStartIndex >= 0 ? eyeStartIndex : 0
  const shadowOffset = shadowStartIndex >= 0 ? shadowStartIndex : 0
  const pairCount = Math.min(orderedEyes.length, orderedShadows.length)

  for (let index = 0; index < pairCount; index += 1) {
    bindings.set(
      orderedEyes[(eyeOffset + index) % orderedEyes.length],
      orderedShadows[(shadowOffset + index) % orderedShadows.length]
    )
  }

  return bindings
}

export function accessoryRecolorKind(file) {
  return FIXED_COLOR_ACCESSORY_FILES.has(file) ? 'plain' : 'blush'
}

export function randomBlushColor(random = Math.random) {
  const hue = BLUSH_HUES[Math.floor(random() * BLUSH_HUES.length)]
  const saturationRoll = random()
  let saturation

  if (saturationRoll < 0.62) {
    saturation = 22 + Math.floor(random() * 15)
  } else if (saturationRoll < 0.92) {
    saturation = 37 + Math.floor(random() * 11)
  } else {
    saturation = 48 + Math.floor(random() * 7)
  }

  return {
    h: hue,
    s: saturation,
    v: 88 + Math.floor(random() * 8)
  }
}
