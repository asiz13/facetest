import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  accessoryRecolorKind,
  buildEyeShadowBindings,
  randomBlushColor
} from '../src/assetRules.js'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const assetFolders = [
  'behindhair',
  'clothes',
  'eyebrow',
  'eyes',
  'eyes-sh',
  'fonthair',
  'head',
  'mouths',
  'noses',
  'shy'
]

function imageFiles(folder) {
  return fs
    .readdirSync(path.join(projectRoot, folder))
    .filter((file) => /\.(?:png|jpe?g)$/i.test(file))
    .sort()
}

const eyeFiles = [
  'IMG_0673.PNG',
  'IMG_0664.PNG',
  'IMG_0674.PNG',
  'IMG_0675.PNG'
]
const shadowFiles = [
  'IMG_0698.PNG',
  'IMG_0715.PNG',
  'IMG_0697.PNG',
  'IMG_0699.PNG'
]

test('eye shadows keep the special pair and otherwise bind by ascending number', () => {
  const bindings = buildEyeShadowBindings(eyeFiles, shadowFiles)

  assert.equal(bindings.get('IMG_0664.PNG'), 'IMG_0715.PNG')
  assert.equal(bindings.get('IMG_0673.PNG'), 'IMG_0697.PNG')
  assert.equal(bindings.get('IMG_0674.PNG'), 'IMG_0698.PNG')
  assert.equal(bindings.get('IMG_0675.PNG'), 'IMG_0699.PNG')
})

test('the current eye library has nineteen complete shadow bindings and no old eyes', () => {
  const currentEyeFiles = imageFiles('eyes')
  const currentShadowFiles = imageFiles('eyes-sh')
  const expectedEyeFiles = [
    'IMG_0664.PNG',
    ...Array.from({ length: 18 }, (_, index) => `IMG_${String(673 + index).padStart(4, '0')}.PNG`)
  ]
  const bindings = buildEyeShadowBindings(currentEyeFiles, currentShadowFiles)

  assert.deepEqual(currentEyeFiles, expectedEyeFiles)
  assert.equal(currentShadowFiles.length, 19)
  assert.equal(bindings.size, 19)
  for (let index = 0; index < 18; index += 1) {
    assert.equal(
      bindings.get(`IMG_${String(673 + index).padStart(4, '0')}.PNG`),
      `IMG_${String(697 + index).padStart(4, '0')}.PNG`
    )
  }
})

test('every current source asset has exactly one preview and no orphan remains', () => {
  const expectedPreviews = assetFolders.flatMap((folder) =>
    imageFiles(folder).map((file) => {
      const stem = path.basename(file, path.extname(file))
      return `${stem}${/\.jpe?g$/i.test(file) ? '-jpg' : ''}.webp`
    })
  )
  const currentPreviews = fs
    .readdirSync(path.join(projectRoot, 'public', 'previews-webp'))
    .sort()

  assert.deepEqual(currentPreviews, expectedPreviews.sort())
})

test('the fifth face decoration keeps its original color', () => {
  assert.equal(accessoryRecolorKind('IMG_0609.PNG'), 'plain')
  assert.equal(accessoryRecolorKind('IMG_0608.PNG'), 'blush')
})

test('random face decoration colors rarely enter the high-saturation range', () => {
  let seed = 123456789
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0
    return seed / 2 ** 32
  }
  const colors = Array.from({ length: 1000 }, () => randomBlushColor(random))
  const highSaturationCount = colors.filter((color) => color.s >= 50).length

  assert.ok(colors.every((color) => color.s >= 22 && color.s <= 54))
  assert.ok(colors.every((color) => color.v >= 88 && color.v <= 95))
  assert.ok(highSaturationCount / colors.length < 0.1)
})
