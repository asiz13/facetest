import assert from 'node:assert/strict'
import test from 'node:test'
import {
  recolorEyes,
  recolorHair,
  recolorNose,
  removeWhiteBackdrop,
  rgbToHsv
} from '../src/imageProcessing.js'

function makeImageData(...pixels) {
  return {
    data: Uint8ClampedArray.from(pixels.flat()),
    width: pixels.length,
    height: 1
  }
}

function pixelAt(imageData, index) {
  return Array.from(imageData.data.slice(index * 4, index * 4 + 4))
}

test('hair shadows stay colored and darker than the selected base hair color', () => {
  const imageData = makeImageData(
    [40, 40, 40, 255],
    [120, 120, 120, 255],
    [220, 220, 220, 255]
  )

  recolorHair(imageData, { h: 210, s: 70, v: 50 })

  const shadow = pixelAt(imageData, 0)
  const base = pixelAt(imageData, 1)
  assert.notEqual(shadow[0], shadow[1])
  assert.ok(Math.max(...shadow.slice(0, 3)) < Math.max(...base.slice(0, 3)))
})

test('hair shadows use the target hue with a 17-point saturation increase', () => {
  const imageData = makeImageData(
    [40, 40, 40, 255],
    [120, 120, 120, 255],
    [220, 220, 220, 255]
  )

  recolorHair(imageData, { h: 210, s: 50, v: 50 })

  const shadow = rgbToHsv(...pixelAt(imageData, 0).slice(0, 3))
  const base = rgbToHsv(...pixelAt(imageData, 2).slice(0, 3))
  assert.ok(Math.abs(shadow.h - 210) < 1)
  assert.ok(Math.abs(shadow.s - 0.67) < 0.02)
  assert.ok(Math.abs(base.s - 0.5) < 0.02)
})

test('hair styles with shadow pixels dominating the image keep their brighter base', () => {
  const imageData = makeImageData(
    ...Array.from({ length: 6 }, () => [90, 0, 0, 255]),
    ...Array.from({ length: 4 }, () => [255, 0, 0, 255])
  )

  recolorHair(imageData, { h: 210, s: 70, v: 50 })

  const shadow = pixelAt(imageData, 0)
  const base = pixelAt(imageData, 6)
  assert.notEqual(shadow[0], shadow[1])
  assert.ok(Math.max(...shadow.slice(0, 3)) < Math.max(...base.slice(0, 3)) * 0.75)
})

test('eye recoloring uses one target hue and preserves smooth light-dark shading', () => {
  const imageData = makeImageData(
    [255, 0, 0, 255],
    [255, 255, 0, 255],
    [128, 0, 0, 255],
    [255, 255, 255, 255],
    [0, 0, 0, 255]
  )

  recolorEyes(imageData, { h: 200, s: 100, v: 80 })

  const brightIris = rgbToHsv(...pixelAt(imageData, 1).slice(0, 3))
  const midIris = rgbToHsv(...pixelAt(imageData, 0).slice(0, 3))
  const darkIris = rgbToHsv(...pixelAt(imageData, 2).slice(0, 3))

  for (const iris of [brightIris, midIris, darkIris]) {
    assert.ok(Math.abs(iris.h - 200) < 1)
  }
  assert.ok(brightIris.v <= 0.81)
  assert.ok(brightIris.v - darkIris.v > 0.25)
  assert.deepEqual(pixelAt(imageData, 3).slice(0, 3), [255, 255, 255])
  assert.deepEqual(pixelAt(imageData, 4).slice(0, 3), [0, 0, 0])
})

test('eye brightness control changes the base while retaining its source shading', () => {
  const source = [
    [255, 0, 0, 255],
    [255, 255, 0, 255],
    [128, 0, 0, 255]
  ]
  const dim = makeImageData(...source)
  const bright = makeImageData(...source)

  recolorEyes(dim, { h: 200, s: 85, v: 45 })
  recolorEyes(bright, { h: 200, s: 85, v: 85 })

  const dimBase = rgbToHsv(...pixelAt(dim, 1).slice(0, 3)).v
  const brightBase = rgbToHsv(...pixelAt(bright, 1).slice(0, 3)).v
  const dimContrast =
    rgbToHsv(...pixelAt(dim, 1).slice(0, 3)).v -
    rgbToHsv(...pixelAt(dim, 2).slice(0, 3)).v
  const brightContrast =
    rgbToHsv(...pixelAt(bright, 1).slice(0, 3)).v -
    rgbToHsv(...pixelAt(bright, 2).slice(0, 3)).v

  assert.ok(brightBase > dimBase + 0.2)
  assert.ok(brightContrast > 0.2)
  assert.ok(dimContrast > 0.1)
})

test('nose recoloring includes warm shadow pixels and keeps their depth', () => {
  const imageData = makeImageData([255, 80, 30, 255], [255, 245, 230, 255])

  recolorNose(imageData, { r: 240, g: 210, b: 180 })

  const shadow = pixelAt(imageData, 0)
  const highlight = pixelAt(imageData, 1)
  assert.notDeepEqual(shadow.slice(0, 3), [255, 80, 30])
  assert.ok(shadow[0] < highlight[0])
  assert.deepEqual(highlight.slice(0, 3), [240, 210, 180])
})

test('JPEG white backdrops become transparent without removing enclosed highlights', () => {
  const pixels = Array.from({ length: 25 }, () => [255, 255, 255, 255])
  for (let y = 1; y <= 3; y += 1) {
    for (let x = 1; x <= 3; x += 1) {
      pixels[y * 5 + x] = [18, 16, 82, 255]
    }
  }
  pixels[12] = [255, 255, 255, 255]
  pixels[0] = [220, 220, 220, 255]
  const imageData = {
    data: Uint8ClampedArray.from(pixels.flat()),
    width: 5,
    height: 5
  }

  removeWhiteBackdrop(imageData)

  assert.equal(pixelAt(imageData, 1)[3], 0)
  assert.equal(pixelAt(imageData, 6)[3], 255)
  assert.equal(pixelAt(imageData, 12)[3], 255)
  assert.ok(pixelAt(imageData, 0)[3] > 0 && pixelAt(imageData, 0)[3] < 255)
})

test('JPEG backdrop removal keeps colored hair shadows darker than the hair base', () => {
  const pixels = Array.from({ length: 49 }, () => [255, 255, 255, 255])
  for (const index of [16, 17, 18, 23, 24, 25, 30]) {
    pixels[index] = [100, 105, 180, 255]
  }
  for (const index of [22, 26]) {
    pixels[index] = [24, 28, 82, 255]
  }
  const imageData = {
    data: Uint8ClampedArray.from(pixels.flat()),
    width: 7,
    height: 7
  }

  removeWhiteBackdrop(imageData)
  recolorHair(imageData, { h: 210, s: 70, v: 50 })

  const background = pixelAt(imageData, 0)
  const shadow = pixelAt(imageData, 22)
  const base = pixelAt(imageData, 16)
  assert.equal(background[3], 0)
  assert.notEqual(shadow[0], shadow[1])
  assert.ok(Math.max(...shadow.slice(0, 3)) < Math.max(...base.slice(0, 3)))
})
