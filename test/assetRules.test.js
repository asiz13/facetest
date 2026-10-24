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
  'IMG_0735.PNG',
  'IMG_0722.PNG',
  'IMG_0736.PNG',
  'IMG_0723.PNG'
]
const shadowFiles = [
  'IMG_0765.PNG',
  'IMG_0763.PNG',
  'IMG_0766.PNG',
  'IMG_0764.PNG'
]

test('eye shadows bind from the declared start pair and follow sorted order', () => {
  const bindings = buildEyeShadowBindings(eyeFiles, shadowFiles)

  assert.equal(bindings.get('IMG_0722.PNG'), 'IMG_0763.PNG')
  assert.equal(bindings.get('IMG_0723.PNG'), 'IMG_0764.PNG')
  assert.equal(bindings.get('IMG_0735.PNG'), 'IMG_0765.PNG')
  assert.equal(bindings.get('IMG_0736.PNG'), 'IMG_0766.PNG')
})

test('the current eye library has eighteen complete shadow bindings and no old eyes', () => {
  const currentEyeFiles = imageFiles('eyes')
  const currentShadowFiles = imageFiles('eyes-sh')
  const expectedEyeFiles = [
    'IMG_0722.PNG',
    'IMG_0723.PNG',
    ...Array.from({ length: 5 }, (_, index) => `IMG_${String(735 + index).padStart(4, '0')}.PNG`),
    ...Array.from({ length: 11 }, (_, index) => `IMG_${String(742 + index).padStart(4, '0')}.PNG`)
  ]
  const expectedShadowFiles = [
    ...Array.from({ length: 8 }, (_, index) => `IMG_${String(763 + index).padStart(4, '0')}.PNG`),
    ...Array.from({ length: 10 }, (_, index) => `IMG_${String(753 + index).padStart(4, '0')}.PNG`)
  ]
  const bindings = buildEyeShadowBindings(currentEyeFiles, currentShadowFiles)

  assert.deepEqual(currentEyeFiles, expectedEyeFiles)
  assert.deepEqual(currentShadowFiles, [...expectedShadowFiles].sort())
  assert.equal(bindings.size, 18)
  for (let index = 0; index < expectedEyeFiles.length; index += 1) {
    assert.equal(bindings.get(expectedEyeFiles[index]), expectedShadowFiles[index])
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
