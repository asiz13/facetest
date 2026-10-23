const EYE_SHADOW_SPECIAL_PAIR = ['IMG_0664.PNG', 'IMG_0715.PNG']
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
  const availableEyeFiles = new Map(
    eyeFiles.map((file) => [normalizedFileKey(file), file])
  )
  const availableShadowFiles = new Map(
    shadowFiles.map((file) => [normalizedFileKey(file), file])
  )
  const bindings = new Map()
  const [specialEye, specialShadow] = EYE_SHADOW_SPECIAL_PAIR
  const specialShadowFile = availableShadowFiles.get(normalizedFileKey(specialShadow))

  if (availableEyeFiles.has(normalizedFileKey(specialEye)) && specialShadowFile) {
    bindings.set(availableEyeFiles.get(normalizedFileKey(specialEye)), specialShadowFile)
  }

  const regularEyes = eyeFiles
    .filter((file) => normalizedFileKey(file) !== normalizedFileKey(specialEye))
    .sort(numericFileOrder)
  const regularShadows = shadowFiles
    .filter((file) => normalizedFileKey(file) !== normalizedFileKey(specialShadow))
    .sort(numericFileOrder)

  const pairCount = Math.min(regularEyes.length, regularShadows.length)
  for (let index = 0; index < pairCount; index += 1) {
    bindings.set(regularEyes[index], regularShadows[index])
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
