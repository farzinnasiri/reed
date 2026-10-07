import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Vector2 } from 'three';
import { onboardingAppearance } from '../components/onboarding/body-appearance';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BodyScene } from '../components/body-3d/body-scene';
import { manifest, regionForTriangle, resolveMuscles, type BodyVariant } from '../components/body-3d/contract';
import { decodeBodyAsset } from '../components/body-3d/decode';

// Node does not render textures. Real texture loading/rendering is checked in the browser.
Object.defineProperty(globalThis, 'self', { value: globalThis, configurable: true });
Object.defineProperty(globalThis, 'createImageBitmap', { value: async () => ({ width: 1024, height: 1024, close() {} }), configurable: true });

for (const variant of ['male', 'female'] satisfies BodyVariant[]) {
  test(`${variant}: lossless delivery, morphed geometry and semantic picking`, async () => {
    const compressed = readFileSync(`assets/body-3d/v3.4/compressed/${variant}.glb.gz`);
    const original = readFileSync(`assets/body-3d/v3.4/${variant}.glb`);
    const decoded = decodeBodyAsset(compressed, variant);
    assert.deepEqual(Buffer.from(decoded), original);
    assert.deepEqual(Buffer.from(decodeBodyAsset(original, variant)), original);
    const corrupt = compressed.slice();
    corrupt[100] ^= 1;
    assert.throws(() => decodeBodyAsset(corrupt, variant), /integrity/);
    const gltf = await new GLTFLoader().parseAsync(decoded, '');
    const scene = new BodyScene(gltf.scene, variant);
    try {
      assert.equal(scene.meshes.length, 80);
      assert.equal(scene.patches.size, 79);
      assert.equal([...scene.patches.values()].filter(mesh => mesh.visible).length, 0);
      assert.equal(new Set([...scene.patches.values()].map(mesh => mesh.material)).size, 79);
      const palette = { canvas: '#121110', primary: '#e33e42', secondary: '#eba360', pending: '#3d66f2', pain: ['#8d867b', '#97d8a6', '#eba360', '#e9663a', '#df343b'] };
      const visiblePatches = () => [...scene.patches.entries()].filter(([, mesh]) => mesh.visible).map(([name]) => name).sort();
      scene.applyHighlights({ pain: {}, primary: [], secondary: [] }, 'right_front_thigh', palette);
      assert.deepEqual(visiblePatches(), ['pain_right_front_thigh']);
      assert.equal(scene.patches.get('pain_right_front_thigh')!.material.color.getHexString(), '3d66f2', 'Unset severity must show blue independently of the muscle or gender colour');
      scene.applyHighlights({ pain: { right_front_thigh: 4 }, primary: [], secondary: [] }, 'right_front_thigh', palette);
      assert.equal(scene.patches.get('pain_right_front_thigh')!.material.color.getHexString(), 'df343b', 'Severity replaces pending blue with its own colour');
      scene.applyHighlights({ pain: { right_front_thigh: 4 }, primary: [], secondary: [] }, null, palette);
      assert.deepEqual(visiblePatches(), ['pain_right_front_thigh'], 'Front thigh discomfort must not select the back or hip');
      scene.applyHighlights({ pain: { right_back_thigh: 2 }, primary: [], secondary: [] }, null, palette);
      assert.deepEqual(visiblePatches(), ['pain_right_back_thigh']);
      scene.applyHighlights({ pain: {}, primary: ['quads'], secondary: ['hamstrings'] }, null, palette);
      assert.deepEqual(visiblePatches(), ['muscle_left_hamstrings', 'muscle_left_quadriceps', 'muscle_right_hamstrings', 'muscle_right_quadriceps']);
      assert.notEqual(scene.patches.get('muscle_left_hamstrings')!.material.color.getHex(), scene.patches.get('muscle_left_quadriceps')!.material.color.getHex());
      scene.applyHighlights({ pain: {}, primary: [], secondary: [] }, null, palette);
      assert.deepEqual(visiblePatches(), [], 'Clearing selection must hide every patch');
      // Regression: abdomen/back highlights used to contain disconnected inner-arm islands.
      for (const name of ['pain_abdomen', 'pain_lower_back']) {
        const positions = scene.patches.get(name)!.geometry.getAttribute('position');
        for (let vertex = 0; vertex < positions.count; vertex++) {
          assert.ok(Math.abs(positions.getX(vertex)) < .21, `${name} must stay on the torso`);
        }
      }
      for (const region of manifest.discomfortRegions.filter(region => /biceps|triceps/.test(region.id))) {
        const overlay = scene.patches.get(region.highlightNode)!;
        assert.ok(overlay, 'Arm pain patch is authored in the asset');
        const run = manifest.variants[variant].selectionTriangleRuns.find(run => run[2] === region.id)!;
        assert.equal(regionForTriangle(variant, Number(run[0])), region.id);
      }
      const base = scene.anchor('abdomen')!;
      scene.applyAppearance({ adiposity: 1, muscularity: 1 });
      assert.ok(scene.anchor('abdomen')!.distanceTo(base) > .005, 'Morphs must move the actual pick surface');
      for (const mesh of scene.meshes) assert.deepEqual(mesh.morphTargetInfluences, [1, 1, 1]);
      scene.applyAppearance({ adiposity: .5, muscularity: .4 });
      for (const mesh of scene.meshes) assert.deepEqual(mesh.morphTargetInfluences, [.5, .4, .2]);
      scene.frame(360, 320);
      // A visible abdomen triangle must win over a nearby hip/other anchor.
      // Exercise the actual screen-space raycast at the torso/pelvis boundary.
      scene.rotate(0);
      let abdomenSamples = 0;
      for (let y = 125; y < 190; y += 2) {
        for (let x = 155; x <= 205; x += 2) {
          scene.raycaster.setFromCamera(new Vector2(x / 360 * 2 - 1, 1 - y / 320 * 2), scene.camera);
          const hit = scene.raycaster.intersectObject(scene.body, false)[0];
          if (hit?.faceIndex == null || regionForTriangle(variant, hit.faceIndex) !== 'abdomen') continue;
          abdomenSamples++;
          assert.equal(scene.pick(x, y)?.regionId, 'abdomen', `Direct abdomen hit at ${x},${y} must not snap to a hip`);
        }
      }
      assert.ok(abdomenSamples > 20);
      const covered = new Set<string>();
      for (const yaw of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        scene.rotate(yaw);
        for (const region of manifest.discomfortRegions) {
          const world = scene.anchor(region.id)!;
          const pixel = scene.project(world);
          scene.raycaster.setFromCamera(new Vector2(pixel.x / scene.width * 2 - 1, 1 - pixel.y / scene.height * 2), scene.camera);
          const hit = scene.raycaster.intersectObject(scene.body, false)[0];
          if (!hit || hit.point.distanceTo(world) > .003) continue;
          const picked = scene.pick(pixel.x, pixel.y);
          assert.equal(picked?.area, region.storedAreaLabel);
          covered.add(region.id);
        }
      }
      assert.equal(covered.size, 45);
      assert.equal(scene.pick(0, 0), null);
    } finally { scene.dispose(); }
  });
}

test('Catalog aliases exclude unknown anatomy and preserve left/right groups', () => {
  assert.deepEqual([...resolveMuscles(['  QUADS  '])].sort(), ['left_quadriceps', 'right_quadriceps']);
  assert.deepEqual([...resolveMuscles(['left_quadriceps'])], ['left_quadriceps']);
  assert.equal(resolveMuscles(['not a muscle', 'cardiorespiratory system', 'thumbs']).size, 0);
});

test('Discomfort locations distinguish anterior/posterior legs and pelvis', () => {
  const ids = new Set(manifest.discomfortRegions.map(region => region.id));
  for (const side of ['left', 'right']) {
    for (const part of ['front_thigh', 'back_thigh', 'inner_thigh', 'shin', 'calf', 'knee', 'back_knee', 'hip', 'glute', 'groin', 'foot', 'heel', 'forearm', 'wrist', 'hand']) {
      assert.ok(ids.has(`${side}_${part}`), `${side}_${part} needs its own pick location and patch`);
    }
    assert.ok(!ids.has(`${side}_thigh`), 'A thigh must not be a circumferential pain patch');
  }
});

test('Onboarding body appearance uses shape choice and keeps maximal musculature', () => {
  assert.deepEqual(onboardingAppearance(null), { adiposity: .4, muscularity: 1 });
  assert.equal(onboardingAppearance('average_lean').adiposity, .4);
  assert.equal(onboardingAppearance('very_lean').adiposity, 0);
  assert.equal(onboardingAppearance('high_fat').adiposity, 1);
  assert.equal(onboardingAppearance('larger_high_fat').adiposity, 1);
  assert.ok(onboardingAppearance('soft_middle').adiposity > onboardingAppearance('lean').adiposity);
});
