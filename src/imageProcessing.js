const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0

  if (delta > 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6)
    else if (max === g) h = 60 * ((b - r) / delta + 2)
    else h = 60 * ((r - g) / delta + 4)
  }

  if (h < 0) h += 360

  return {
    h,
    s: max === 0 ? 0 : delta / max,
    v: max / 255
  }
}

export function hsvToRgb(h, s, v) {
  const hue = ((h % 360) + 360) % 360
  const chroma = v * s
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = v - chroma
  let r = 0
  let g = 0
  let b = 0

  if (hue < 60) [r, g, b] = [chroma, x, 0]
  else if (hue < 120) [r, g, b] = [x, chroma, 0]
  else if (hue < 180) [r, g, b] = [0, chroma, x]
  else if (hue < 240) [r, g, b] = [0, x, chroma]
  else if (hue < 300) [r, g, b] = [x, 0, chroma]
  else [r, g, b] = [chroma, 0, x]

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  }
}

function hasTransparentNeighbor(data, width, height, index, radius = 2) {
  const pixel = index / 4
  const x = pixel % width
  const y = Math.floor(pixel / width)
  const minX = Math.max(0, x - radius)
  const maxX = Math.min(width - 1, x + radius)
  const minY = Math.max(0, y - radius)
  const maxY = Math.min(height - 1, y + radius)

  for (let ny = minY; ny <= maxY; ny += 1) {
    for (let nx = minX; nx <= maxX; nx += 1) {
      if (data[(ny * width + nx) * 4 + 3] < 12) return true
    }
  }

  return false
}

function hairToneProfile(imageData) {
  const data = imageData.data
  const valueHistogram = new Uint32Array(256)
  const saturationHistogram = new Uint32Array(256)
  let total = 0

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (r + g + b > 735 && max - min < 18) continue

    const saturation = max === 0 ? 0 : (max - min) / max
    valueHistogram[max] += 1
    saturationHistogram[Math.round(saturation * 255)] += 1
    total += 1
  }

  if (total === 0) {
    return {
      low: 0,
      base: 128,
      high: 255,
      baseSaturation: 0.5,
      highSaturation: 0.5
    }
  }

  const percentile = (histogram, ratio) => {
    const target = total * ratio
    let running = 0
    for (let index = 0; index < histogram.length; index += 1) {
      running += histogram[index]
      if (running >= target) return index
    }
    return 255
  }

  return {
    low: percentile(valueHistogram, 0.08),
    base: percentile(valueHistogram, 0.5),
    high: percentile(valueHistogram, 0.92),
    baseSaturation: percentile(saturationHistogram, 0.5) / 255,
    highSaturation: percentile(saturationHistogram, 0.92) / 255
  }
}

export function recolorHair(imageData, target, options = {}) {
  const data = imageData.data
  const targetSaturation = target.s / 100
  const targetValue = target.v / 100
  const {
    low,
    base,
    high,
    baseSaturation,
    highSaturation
  } = hairToneProfile(imageData)
  const shadowSpan = Math.max(base - low, 24)
  const highlightSpan = Math.max(high - base, 24)
  const saturationShadowSpan = Math.max(highSaturation - baseSaturation, 0.08)
  const hasSaturationLayers = highSaturation - baseSaturation > 0.08
  const outlineValue = targetValue * (0.12 + targetValue * 0.28)
  const layerShadowValue = targetValue * (0.36 + targetValue * 0.22)
  const highlightValue = clamp(
    targetValue + (1 - targetValue) * 0.18,
    targetValue + 0.05,
    0.98
  )

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha === 0) continue

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const hsv = rgbToHsv(r, g, b)

    if (options.stripWhiteEdge && hsv.value > 0.9 && hsv.s < 0.08) {
      const softEdge = alpha < 250
      const boundaryEdge = hasTransparentNeighbor(
        data,
        imageData.width,
        imageData.height,
        i
      )
      if (softEdge || boundaryEdge) {
        data[i + 3] = 0
        continue
      }
    }

    const sourceValue = hsv.v * 255
    const valueShadow = sourceValue < base
      ? Math.pow(clamp((base - sourceValue) / shadowSpan, 0, 1), 0.78)
      : 0
    const saturationShadow = hasSaturationLayers
      ? clamp((hsv.s - baseSaturation) / saturationShadowSpan, 0, 1)
      : 0
    const shadowTone = Math.max(valueShadow, saturationShadow)
    const shadowValue = valueShadow >= saturationShadow
      ? outlineValue
      : layerShadowValue
    const deepShadow = low > 0
      ? clamp((low - sourceValue) / low, 0, 1) * 0.55
      : 0
    const relativeTone = sourceValue < base
      ? -(
          Math.pow(shadowTone, 0.8) +
          deepShadow
        )
      : Math.pow(clamp((sourceValue - base) / highlightSpan, 0, 1), 0.88)
    const saturation = clamp(targetSaturation * (0.94 + Math.abs(relativeTone) * 0.06), 0, 1)
    const value = clamp(
      relativeTone < 0
        ? targetValue + relativeTone * (targetValue - shadowValue)
        : targetValue + relativeTone * (highlightValue - targetValue),
      0,
      1
    )
    const output = hsvToRgb(target.h, saturation, value)

    data[i] = output.r
    data[i + 1] = output.g
    data[i + 2] = output.b
  }
}

export function recolorBlush(imageData, target) {
  const data = imageData.data
  const targetSaturation = clamp(target.s / 100, 0.25, 0.65)
  const targetValue = clamp(target.v / 100, 0.55, 0.95)

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha < 4) continue

    const source = rgbToHsv(data[i], data[i + 1], data[i + 2])
    if (source.s < 0.025 && source.v > 0.96) continue

    const sourceShade = clamp(0.82 + source.v * 0.18, 0.82, 1)
    const output = hsvToRgb(target.h, targetSaturation, targetValue * sourceShade)
    data[i] = output.r
    data[i + 1] = output.g
    data[i + 2] = output.b
  }
}

export function recolorEyes(imageData, target, options = {}) {
  const data = imageData.data
  const targetSaturation = target.s / 100
  const targetValue = target.v / 100
  const whiteBlend = clamp(options.whiteBlend ?? 0, 0, 0.22)

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha < 8) continue

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const saturation = max === 0 ? 0 : (max - min) / max
    const value = max / 255

    if (max === min || saturation < 0.16) {
      if (whiteBlend > 0 && value > 0.72) {
        const blend = whiteBlend * value
        data[i] = Math.round(r * (1 - blend) + 255 * blend)
        data[i + 1] = Math.round(g * (1 - blend) + 246 * blend)
        data[i + 2] = Math.round(b * (1 - blend) + 239 * blend)
      }
      continue
    }
    if (value < 0.11 || saturation < 0.2) continue

    const shade = clamp(value / 0.9, 0.22, 1.16)
    const outputSaturation = clamp(
      targetSaturation * clamp(saturation / 0.82, 0.72, 1.12),
      0,
      1
    )
    const outputValue = clamp(targetValue * shade, 0, 1)
    const output = hsvToRgb(target.h, outputSaturation, outputValue)

    data[i] = output.r
    data[i + 1] = output.g
    data[i + 2] = output.b
  }
}

export function recolorSkin(imageData, target) {
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha === 0) continue

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const saturation = max === 0 ? 0 : (max - min) / max
    const value = max / 255
    const warmOrder = r >= g - 4 && g >= b - 8 && r - b > 3
    const warmSkin = warmOrder && value > 0.42 && saturation < 0.52
    const paleSkin = value > 0.9 && saturation < 0.12 && r >= g - 2 && g >= b - 2
    const isSkin = warmSkin || paleSkin

    if (!isSkin) continue

    const shade = value > 0.82 ? 1 : clamp(0.58 + value * 0.5, 0.62, 1.08)
    data[i] = Math.round(clamp(target.r * shade, 0, 255))
    data[i + 1] = Math.round(clamp(target.g * shade, 0, 255))
    data[i + 2] = Math.round(clamp(target.b * shade, 0, 255))
  }
}
