const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function hueDistance(first, second) {
  const distance = Math.abs(((first - second) % 360 + 360) % 360)
  return Math.min(distance, 360 - distance)
}

function hueFromRgb(r, g, b, max, min) {
  const delta = max - min
  if (delta === 0) return 0

  let hue
  if (max === r) hue = 60 * (((g - b) / delta) % 6)
  else if (max === g) hue = 60 * ((b - r) / delta + 2)
  else hue = 60 * ((r - g) / delta + 4)

  return hue < 0 ? hue + 360 : hue
}

function createHsvWriter(data, hue) {
  const normalizedHue = ((hue % 360) + 360) % 360
  const sector = Math.floor(normalizedHue / 60)
  const sectorPosition = normalizedHue / 60 - sector
  const xFactor = sector % 2 === 0 ? sectorPosition : 1 - sectorPosition
  const [highChannel, middleChannel, lowChannel] = [
    [0, 1, 2],
    [1, 0, 2],
    [1, 2, 0],
    [2, 1, 0],
    [2, 0, 1],
    [0, 2, 1]
  ][sector]

  return (index, saturation, value) => {
    const chroma = value * saturation
    const x = chroma * xFactor
    const m = value - chroma
    data[index + highChannel] = Math.round((chroma + m) * 255)
    data[index + middleChannel] = Math.round((x + m) * 255)
    data[index + lowChannel] = Math.round(m * 255)
  }
}

function writeHsvToRgb(data, index, hue, saturation, value) {
  const normalizedHue = ((hue % 360) + 360) % 360
  const chroma = value * saturation
  const x = chroma * (1 - Math.abs(((normalizedHue / 60) % 2) - 1))
  const m = value - chroma
  const sector = Math.floor(normalizedHue / 60) % 6
  let r
  let g
  let b

  if (sector === 0) {
    r = chroma
    g = x
    b = 0
  } else if (sector === 1) {
    r = x
    g = chroma
    b = 0
  } else if (sector === 2) {
    r = 0
    g = chroma
    b = x
  } else if (sector === 3) {
    r = 0
    g = x
    b = chroma
  } else if (sector === 4) {
    r = x
    g = 0
    b = chroma
  } else {
    r = chroma
    g = 0
    b = x
  }

  data[index] = Math.round((r + m) * 255)
  data[index + 1] = Math.round((g + m) * 255)
  data[index + 2] = Math.round((b + m) * 255)
}

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

export function removeWhiteBackdrop(imageData) {
  const { data, width, height } = imageData
  const pixelCount = width * height
  const visited = new Uint8Array(pixelCount)
  const queue = new Uint32Array(pixelCount)
  let head = 0
  let tail = 0

  const enqueueIfBackdrop = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const pixel = y * width + x
    if (visited[pixel]) return

    const index = pixel * 4
    const r = data[index]
    const g = data[index + 1]
    const b = data[index + 2]
    if (Math.min(r, g, b) < 180 || Math.max(r, g, b) - Math.min(r, g, b) > 70) return

    visited[pixel] = 1
    queue[tail] = pixel
    tail += 1
  }

  for (let x = 0; x < width; x += 1) {
    enqueueIfBackdrop(x, 0)
    enqueueIfBackdrop(x, height - 1)
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueueIfBackdrop(0, y)
    enqueueIfBackdrop(width - 1, y)
  }

  while (head < tail) {
    const pixel = queue[head]
    head += 1
    const x = pixel % width
    const y = Math.floor(pixel / width)
    enqueueIfBackdrop(x - 1, y)
    enqueueIfBackdrop(x + 1, y)
    enqueueIfBackdrop(x, y - 1)
    enqueueIfBackdrop(x, y + 1)
  }

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (!visited[pixel]) continue

    const index = pixel * 4
    const minChannel = Math.min(data[index], data[index + 1], data[index + 2])
    const alpha = clamp((255 - minChannel) / 190, 0, 1)
    if (alpha < 0.06) {
      data[index + 3] = 0
      continue
    }

    const whiteContribution = 255 * (1 - alpha)
    data[index] = Math.round(clamp((data[index] - whiteContribution) / alpha, 0, 255))
    data[index + 1] = Math.round(clamp((data[index + 1] - whiteContribution) / alpha, 0, 255))
    data[index + 2] = Math.round(clamp((data[index + 2] - whiteContribution) / alpha, 0, 255))
    data[index + 3] = Math.round(alpha * 255)
  }
}

function buildValueProfile(imageData, accept) {
  const data = imageData.data
  const valueHistogram = new Uint32Array(256)
  let total = 0

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const saturation = max === 0 ? 0 : (max - min) / max
    if (!accept({ r, g, b, alpha: data[i + 3], max, min, saturation, value: max / 255 })) continue

    valueHistogram[max] += 1
    total += 1
  }

  if (total === 0) {
    return { low: 0, base: 128, high: 255 }
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
    high: percentile(valueHistogram, 0.92)
  }
}

function buildLuminanceProfile(
  imageData,
  accept,
  { shadowMaskData = null, hueWeights = null } = {}
) {
  const data = imageData.data
  const luminanceHistogram = new Uint32Array(256)
  const valueHistogram = new Uint32Array(256)
  const saturationTotals = new Float64Array(256)
  let maxShadowMaskAlpha = 0
  let hueWeightTotal = 0
  let baseSaturationTotal = 0
  let total = 0

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (shadowMaskData && alpha >= 32) {
      maxShadowMaskAlpha = Math.max(maxShadowMaskAlpha, shadowMaskData[i + 3])
    }
    if (alpha < 8) continue

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const saturation = max === 0 ? 0 : (max - min) / max
    if (!accept(alpha, max, min, saturation, max / 255, r, g, b)) continue

    if (hueWeights && alpha >= 32 && max / 255 > 0.16 && saturation >= 0.16) {
      const weight = saturation * (alpha / 255)
      const hue = Math.round(hueFromRgb(r, g, b, max, min)) % 360
      hueWeights[hue] += weight
      hueWeightTotal += weight
      baseSaturationTotal += saturation * weight
    }

    const luminance = Math.round(r * 0.2126 + g * 0.7152 + b * 0.0722)
    const bin = clamp(luminance, 0, 255)
    luminanceHistogram[bin] += 1
    valueHistogram[max] += 1
    saturationTotals[bin] += saturation
    total += 1
  }

  if (total === 0) {
    return {
      low: 0,
      base: 128,
      baseValue: 128,
      lowValue: 0,
      high: 255,
      baseSaturation: 0,
      maxShadowMaskAlpha,
      hueWeightTotal,
      baseSaturationTotal
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

  // A higher percentile prevents shadow-heavy styles from defining their own base as a shadow.
  const base = percentile(luminanceHistogram, 0.7)

  return {
    low: percentile(luminanceHistogram, 0.01),
    base,
    lowValue: percentile(valueHistogram, 0.01),
    baseValue: percentile(valueHistogram, 0.7),
    high: percentile(luminanceHistogram, 0.99),
    baseSaturation: saturationTotals[base] / luminanceHistogram[base],
    maxShadowMaskAlpha,
    hueWeightTotal,
    baseSaturationTotal
  }
}

function normalizedTargetValue(sourceValue, profile, targetValue, options = {}) {
  const base = profile.base
  if (sourceValue <= base) {
    const span = Math.max(base - profile.low, 1)
    const shadowWeight = Math.pow(clamp((base - sourceValue) / span, 0, 1), options.shadowGamma ?? 0.85)
    const shadowValue = targetValue * (options.shadowFactor ?? 0.16)
    return targetValue + (shadowValue - targetValue) * shadowWeight
  }

  const span = Math.max(profile.high - base, 1)
  const highlightWeight = Math.pow(clamp((sourceValue - base) / span, 0, 1), 0.9)
  const highlightValue = clamp(
    targetValue + (1 - targetValue) * (options.highlightFactor ?? 0.18),
    0,
    1
  )
  return targetValue + (highlightValue - targetValue) * highlightWeight
}

export function recolorHair(imageData, target, options = {}) {
  const data = imageData.data
  const targetSaturation = clamp(target.s / 100, 0, 1)
  const targetValue = clamp(target.v / 100, 0, 1)
  const shadowMaskData = options.shadowMaskData?.data
  const hasShadowMask = shadowMaskData?.length === data.length
  const profile = buildLuminanceProfile(imageData, (alpha, max, _min, saturation) => {
    if (alpha < 160) return false
    if (options.stripWhiteEdge && max > 238 && saturation < 0.08) return false
    return true
  }, {
    shadowMaskData: hasShadowMask ? shadowMaskData : null
  })
  const shadowSpan = Math.max(profile.baseValue - profile.lowValue, 1)
  const shadowBrightnessRatio = 0.44
  const highlightBrightnessRatio = 1.2
  const writeHairColor = createHsvWriter(data, target.h)

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha === 0) continue

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const saturation = max === 0 ? 0 : (max - min) / max

    if (options.stripWhiteEdge && max > 230 && saturation < 0.08) {
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

    // HSV value keeps the same shading contrast across differently colored source art.
    const valueShadow = clamp((profile.baseValue - max) / shadowSpan, 0, 1)
    const shadowWeight = valueShadow
    const highlightWeight = clamp(
      (max - profile.baseValue) / Math.max(255 - profile.baseValue, 24),
      0,
      1
    )
    const brightnessRatio =
      1 -
      (1 - shadowBrightnessRatio) * shadowWeight +
      (highlightBrightnessRatio - 1) * highlightWeight
    const outputValue = clamp(targetValue * brightnessRatio, 0, 1)
    const explicitShadowWeight =
      hasShadowMask && profile.maxShadowMaskAlpha > 0
        ? shadowMaskData[i + 3] / profile.maxShadowMaskAlpha
        : 0
    const inferredShadowWeight =
      options.inferShadowSaturation !== false &&
      max < profile.baseValue &&
      saturation >= 0.14 &&
      max > profile.baseValue * 0.6
        ? 1
        : 0
    writeHairColor(
      i,
      clamp(
        targetSaturation + Math.max(explicitShadowWeight, inferredShadowWeight) * 0.17,
        0,
        1
      ),
      outputValue
    )
  }
}

export function recolorBlush(imageData, target) {
  const data = imageData.data
  const targetSaturation = clamp(target.s / 100, 0, 1)
  const targetValue = clamp(target.v / 100, 0, 1)
  const profile = buildValueProfile(imageData, ({ alpha, max, saturation }) =>
    alpha >= 32 && (max < 246 || saturation > 0.025)
  )

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha < 4) continue

    const source = rgbToHsv(data[i], data[i + 1], data[i + 2])
    if (source.s < 0.025 && source.v > 0.96) continue

    const value = normalizedTargetValue(source.v * 255, profile, targetValue, {
      shadowFactor: 0.68,
      shadowGamma: 0.95,
      highlightFactor: 0.06
    })
    const output = hsvToRgb(target.h, targetSaturation, value)
    data[i] = output.r
    data[i + 1] = output.g
    data[i + 2] = output.b
  }
}

export function recolorEyes(imageData, target, options = {}) {
  const data = imageData.data
  const targetSaturation = clamp(target.s / 100, 0, 1)
  const targetValue = clamp(target.v / 100, 0, 1)
  const whiteBlend = clamp(options.whiteBlend ?? 0, 0, 0.22)
  const lineworkValueLimit = 0.4
  const hueWeights = new Float64Array(360)
  const profile = buildLuminanceProfile(
    imageData,
    (alpha, max, _min, saturation) =>
      alpha >= 32 && max > 28 && saturation >= 0.08,
    { hueWeights }
  )
  let baseHue = 0
  let baseSaturation = profile.baseSaturationTotal

  if (profile.hueWeightTotal > 0) {
    for (let hue = 1; hue < hueWeights.length; hue += 1) {
      if (hueWeights[hue] > hueWeights[baseHue]) baseHue = hue
    }
    baseSaturation /= profile.hueWeightTotal
  } else {
    baseHue = target.h
    baseSaturation = 1
  }
  const hueShift = ((target.h - baseHue + 540) % 360) - 180

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha === 0) continue

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const sourceSaturation = max === 0 ? 0 : (max - min) / max
    const sourceValue = max / 255
    const sourceHue =
      sourceValue < lineworkValueLimit || sourceSaturation >= 0.16
        ? hueFromRgb(r, g, b, max, min)
        : 0
    const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722

    if (alpha < 32) {
      if (
        sourceValue < lineworkValueLimit &&
        sourceSaturation >= 0.16 &&
        hueDistance(sourceHue, baseHue) > 45
      ) {
        const gray = Math.round(luminance)
        data[i] = gray
        data[i + 1] = gray
        data[i + 2] = gray
      }
      continue
    }

    if (sourceSaturation < 0.16 && sourceValue > 0.72) {
      if (whiteBlend > 0) {
        const blend = whiteBlend * sourceValue
        data[i] = Math.round(r * (1 - blend) + 255 * blend)
        data[i + 1] = Math.round(g * (1 - blend) + 246 * blend)
        data[i + 2] = Math.round(b * (1 - blend) + 239 * blend)
      }
      continue
    }

    if (sourceSaturation < 0.16) continue

    if (sourceValue < lineworkValueLimit && hueDistance(sourceHue, baseHue) > 45) {
      const gray = Math.round(luminance)
      data[i] = gray
      data[i + 1] = gray
      data[i + 2] = gray
      continue
    }

    const outputValue = clamp(
      targetValue * (sourceValue * 255 / Math.max(profile.baseValue, 1)),
      0,
      1
    )
    const edgeWeight = clamp(sourceSaturation / 0.16, 0, 1)
    const outputHue = sourceSaturation >= 0.16 ? sourceHue + hueShift : target.h
    const outputSaturation =
      sourceSaturation >= 0.16
        ? clamp(
            sourceSaturation * targetSaturation / Math.max(baseSaturation, 0.16),
            0,
            1
          )
        : targetSaturation * edgeWeight
    writeHsvToRgb(data, i, outputHue, outputSaturation, outputValue)
  }
}

export function recolorEyeShadow(imageData, target) {
  const data = imageData.data
  const shadowShade = 0.9

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    data[i] = Math.round(target.r * shadowShade)
    data[i + 1] = Math.round(target.g * shadowShade)
    data[i + 2] = Math.round(target.b * shadowShade)
  }
}

export function recolorNose(imageData, target) {
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const saturation = max === 0 ? 0 : (max - min) / max
    const value = max / 255
    const warmShadow = r >= g - 40 && g >= b - 48 && r - b > 4 && value > 0.12
    const paleSkin = value > 0.9 && saturation < 0.12 && r >= g - 2 && g >= b - 2

    if (!warmShadow && !paleSkin) continue

    const luminance = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255
    const shade = paleSkin ? 1 : clamp(0.46 + luminance * 0.58, 0.46, 1.04)
    data[i] = Math.round(clamp(target.r * shade, 0, 255))
    data[i + 1] = Math.round(clamp(target.g * shade, 0, 255))
    data[i + 2] = Math.round(clamp(target.b * shade, 0, 255))
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
