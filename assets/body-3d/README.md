# Reed body assets

Two independent, self-contained GLBs for discomfort selection, exercise muscle highlights, and approximate body appearance. Load one variant at a time. Application integration is intentionally outside this asset package.

Lossless smaller delivery alternatives are available in [`compressed/`](compressed/README.md). The original GLBs and their hashes remain unchanged. That handoff compares Meshopt GLBs with gzip copies and explains the loader requirements and APK-size caveat.

## Files

- `male.glb`, `female.glb`: runtime assets.
- `manifest.json`: exact exported node names, final triangle-to-region mappings, labels, aliases, morph contract, bounds, counts, byte sizes, and SHA-256 hashes.
- `previews/`: front, back, side, oblique, pain, exercise, morph, and phone-size renders of the exported GLBs. Contact sheets provide a quick review.
- `../../art/body-3d/reed-bodies.blend`: editable source with packed textures. The preview camera and lights are not exported.
- `../../art/body-3d/export_assets.py`: export, patch synchronization, normal transfer, final triangle mapping, and manifest generation.
- `../../art/body-3d/build_bodies.py`: reproducible rebuild from pinned source assets.
- `../../art/body-3d/contract.json`: semantic and runtime contract used by the exporter.
- `../../art/body-3d/validate_assets.py`: geometry and fresh-import validation.

## Provenance and redistribution

The anatomical foundation is **Blender Studio and community Human Base Meshes v1.4.1**, specifically the realistic male and female bodies. The official [download listing](https://www.blender.org/download/demo-files/) marks the bundle CC0, and its README states that all provided assets are public domain under CC0. [Pinned release](https://download.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip).

CC0 permits commercial use, modification, and redistribution. `art/body-3d/LICENSE.blender-assets.md` records the license evidence; `PROVENANCE.json` records the release archive and authored base hashes. No rig, application code, or unrelated library asset is included.

Version 3 refines the arms, chest and abdominal transitions and rotates the relaxed hands slightly toward the viewer. It delivers male and female only. The foundation introduced in version 2 replaced the original smooth MakeHuman body. The realistic source bodies share vertex correspondence and polygon membership. Reed adds continuous surface relief for pecs, rectus abdominis, obliques, deltoids, arms, scapular/back muscles, quadriceps, hamstrings, glutes, and calves, then samples both bodies onto one common 28,000-triangle topology. An internal midpoint reference maintains shared topology and region membership; it is not a delivered body variant. No muscle is a separate primitive attached to the figure.

`source-data.zip` contains the reduced, authored anatomical base arrays and UVs for offline rebuilding. `prepare_base.py` reproduces that foundation from the pinned official Blender bundle; `anatomy.py` contains the editable relief controls. The original open Blender scene was left intact; all production work used separate background processes.

## Space and structure

Blender uses meters, +Z up, -Y front, +X anatomical left. Exported glTF uses **+Y up, +Z front, +X anatomical left**. Version 3 changes the triangle maps: use this version’s manifest and SHA-256 with these GLBs; do not reuse earlier picking data. A front camera looks from positive Z toward the figure. Anatomical left therefore appears on the viewer's right. The origin is on the ground plane, centered between the feet. All bases are normalized to 1.72 meters tall. Use the per-variant bounds in the manifest to frame the model; height normalization is an asset convention, not a person's measured height.

Each GLB contains:

- `body`: the continuous visible surface, one mesh primitive and one opaque matte material.
- 23 `pain_<region_id>` surface patches.
- 34 `muscle_<left_or_right_group>` surface patches.

Patches contain only their local triangles. There is no full-body copy for each highlight. All surfaces share the authored deformation. The exported base material uses a packed 1K color texture for restrained fitted coverage. There are no pores, colored muscle textures, normal-map dependencies, rig, floor, or platform.

Coverage is part of the body's surface and texture, so it cannot intersect or lag behind the morphing body. All variants have minimal low-waisted fitted coverage; female also has fitted chest coverage. Highlight patches can tint covered regions, keeping exercise explanations available there.

The 34 muscle IDs comprise anatomical left/right versions of pectorals, deltoids, biceps, triceps, forearms, trapezius, latissimus dorsi, mid-back, spinal erectors, abdominals, obliques, glutes, quadriceps, hamstrings, adductors, calves and tibialis anterior. These are fitness-app surface regions, not individually dissected muscles.

## Initialize and highlight

Core glTF has no portable hidden-node flag. Highlight materials therefore export with zero alpha. **Hide all `pain_` and `muscle_` meshes immediately after loading**, then enable only active patches. Otherwise an engine may spend draw calls on transparent meshes.

The patches initially share `reed_highlight`. Clone that material per independently controlled mesh before changing it. Keep the `COLOR_0` attribute and vertex colors enabled: its alpha feathers the boundary. RGB is white, so the app controls the tint. Preserve the matte roughness of 0.88 and metallic value of 0.

Example contract using Three.js concepts, not an app implementation:

```js
const body = scene.getObjectByName('body');
scene.traverse(mesh => {
  if (!mesh.isMesh || mesh === body) return;
  mesh.visible = false;
  mesh.material = mesh.material.clone();
  mesh.material.transparent = true;
  mesh.material.alphaTest = 0;
  mesh.material.depthTest = true;
  mesh.material.depthWrite = false;
  mesh.material.side = THREE.FrontSide;
  mesh.material.polygonOffset = true;
  mesh.material.polygonOffsetFactor = -1;
  mesh.material.polygonOffsetUnits = -1;
  mesh.renderOrder = mesh.name.startsWith('pain_') ? 2 : 1;
});

function highlight(nodeName, color, strength) {
  const mesh = scene.getObjectByName(nodeName);
  mesh.material.color.set(color);
  mesh.material.opacity = Math.max(0, Math.min(1, strength));
  mesh.visible = strength > 0;
}
```

For an exercise, resolve `mainMuscleGroups` and `secondaryMuscleGroups` through `catalogAliases`. Trim and compare case-insensitively. Each alias returns muscle IDs and a representation category. If an ID appears in both roles, primary should take precedence. Use the same node for either role in different exercises; there are no permanent primary or secondary parts. Several patches can remain active simultaneously.

Example: color `muscle_left_quadriceps` and `muscle_right_quadriceps` with the primary tint, and glutes/hamstrings with a weaker secondary tint. Strengths around 0.35–0.65 retain neutral shading. All preview colors are runtime material changes, not baked into a GLB.

For discomfort, address `pain_left_knee`, for example. Map the stored intensity to the app's chosen tint/strength and hide the patch for None. Prefer separate pain/exercise modes. If both must be shown, the documented pain render order gives discomfort priority where patches overlap. Keep depth testing enabled and single-sided rendering; disabling either defeats the occlusion contract. Disable patch shadow casting if the viewer enables shadows.

## Select a discomfort region

Raycast **only `body`**, using the current morphed geometry. Ignore highlight nodes. Take the nearest front-facing body hit. `variants[variant].selectionTriangleRuns` maps the final exported body's single primitive to named areas:

```js
const hit = raycaster.intersectObject(body, false)[0];
const runs = manifest.variants[variant].selectionTriangleRuns;
const run = hit && runs.find(([start, count]) =>
  hit.faceIndex >= start && hit.faceIndex < start + count
);
const regionId = run?.[2] ?? null;
```

A run is `[startTriangleInclusive, triangleCount, regionIdOrNull]`. Indices are triangle numbers, not index-buffer offsets. Null means intentionally unlisted anatomy, including the head/face. Use the region's `storedAreaLabel` to preserve Reed's current labels such as `Left knee` and `Upper back`. Do not persist the exported triangle index as a new product location ID.

Small joints need screen-space tolerance. The manifest provides a representative surface anchor for every area as a triangle plus barycentric weights. Evaluate its position using the current morphed triangle, then project to screen. Allow a 22 CSS-pixel radius around visible joint anchors. Reject an anchor if a closer body surface occludes it. On a direct-ray miss, nearby rays within that radius can find the closest visible surface. This is a runtime selection policy; the asset alone cannot impose touch target size. Keep a labeled area-list alternative available.

Shoulder selection catchments include the upper arm; wrist catchments include the hand/lower forearm because onboarding has no separate labels for those areas. The visible shoulder/wrist patches remain focused on the named joint. Hip includes the gluteal area; calf includes the lower leg. Pain labels indicate location only. They do not identify an injured muscle or imply a diagnosis.

The exporter generates the mapping from the **final exported triangles** and verifies one-to-one correspondence with source faces. Subsequent buffer compaction changes no vertex or triangle order. Check the GLB hash against its manifest entry. Do not merge, decimate, reorder, or optimize geometry after export without regenerating the mapping.

## Apply body shape

All mesh nodes expose exactly these morph target indices:

| Index | Name | Range | Default | Meaning |
|---|---|---|---|---|
| 0 | `adiposity` | 0–1 | 0 | Increased fullness and softness from the defined teaching-figurine base. |
| 1 | `muscularity` | 0–1 | 0 | Increased muscle volume and form. |
| 2 | `fullness_corrective` | 0–1 | 0 | Authored combined-shape correction; set to the product of the first two weights. |

```js
const f = Math.max(0, Math.min(1, adiposity));
const m = Math.max(0, Math.min(1, muscularity));
scene.traverse(mesh => {
  if (!mesh.morphTargetInfluences) return;
  mesh.morphTargetInfluences[0] = f;
  mesh.morphTargetInfluences[1] = m;
  mesh.morphTargetInfluences[2] = f * m;
});
```

Update hidden patches too, so enabling one never reveals stale geometry. Do not expose the corrective as an independent slider or use negative weights. The endpoints are authored on the revised anatomical base: adiposity relaxes surface relief and increases torso, hip, limb and abdominal fullness; muscularity adds volume and definition. The combination corrective retains softness at simultaneous extremes. Smooth armpit, finger and covered-groin restraints prevent folding in small or concave geometry. These are approximate appearances, not body-fat percentages or physiological measurements. Both body variants support the same independent controls.

### Body-fat percentages

The app interpolates these authored morph targets continuously. It does not need a separate GLB for each percentage, and should not try to create anatomy by scaling body parts. A numeric body-fat estimate cannot specify fat distribution, frame, or muscle mass. The delivered weights are appearance controls, not calibrated percentages. Keep adiposity and muscularity independent. If the product later needs a broader range or different distributions, author additional compatible endpoints and blend through them; do not extrapolate these targets beyond 0–1. This release does not span every possible body size.

## Re-export and edit

Validated with Blender 5.2.2 LTS. Commands from the repository root on this Mac:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background art/body-3d/reed-bodies.blend --python art/body-3d/export_assets.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python art/body-3d/validate_assets.py
```

Use `blender` instead of the absolute binary path on other systems. Export one variant with `-- --variant male`, optionally adding `--output /absolute/output/folder`. A single-variant export writes a manifest containing that variant only; use a separate output folder for experiments. Full export recreates the family manifest from `contract.json`.

The current source builder produces v3.2; use the [versioned rebuild instructions](v3.2/README.md). For a reproducible rebuild from the pinned CC0 data:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python art/body-3d/build_bodies.py -- --output art/body-3d/reed-bodies-v3.2.blend
```

The explicit output path preserves `reed-bodies.blend`; preserve manual edits to any chosen output before rebuilding it. Export the v3.2 scene into its versioned directory, then validate and compress it. No network or separate character-generator installation is needed to rebuild. To regenerate the archived foundation itself, download and unzip the pinned official release, then run Blender with that bundle open and `--python art/body-3d/prepare_base.py`. Put the resulting `refined-base.npz` inside `source-data.zip`, then rebuild and export. Preparation repacks the source UDIM islands to one atlas and reduces the shared topology before final picking maps are generated.

For manual shape edits, work on each variant's `<variant>_body` Basis and shape keys. Keep topology and source vertex order unchanged. The exporter synchronizes derived patches using their `reed_source_vertex` point attributes, then transfers the continuous body's normals and morph-normal deltas into the GLB. Do not hand-edit patch geometry or remesh the body without updating the authoring pipeline. Region membership lives in the body's `reed_pain_id` and `reed_muscle_id` face attributes and JSON label properties. Boundary changes should be authored in `build_bodies.py` and rebuilt so patches and picking remain consistent.

## Validation and limitations

See `art/body-3d/geometry-validation.json`, `browser-validation.json`, and `gltf-validation.json` for recorded evidence. `manifest.json` records exact file hashes and measurements. Previews use a restrained lit viewer on Reed's `#121110` canvas. They are actual GLB renders.

The male and female GLBs were exported and independently reimported. Final validation covers both: fresh Blender imports; packed texture, material, names and morph survival; anatomical left/right across every classified triangle; final triangle mapping; patch deformation correspondence; morph defaults, endpoints, combined and midpoint states; runtime selection; simultaneous highlights and role changes; front/back/side/oblique views; and roughly 300-pixel body height.

The GPU pixel comparison tests a lower-back highlight while viewing the front. It changes zero front pixels in all variants. The same quadriceps node visibly changes when assigned primary and secondary appearances. Inactive-node initialization produces one default draw call; two active muscle patches produce three. These are desktop browser measurements, not Android performance validation.

Muscle boundaries are intentionally approximate. Deltoid and pectoral heads are grouped, deep muscles may use a documented overlying indication, and some catalog terms have no surface. Unsupported terms resolve to an empty list; do not silently highlight the entire body. There is no diagnosis, exact body-composition mapping, animation rig, facial identity, or physical-device performance claim.

## Measured export budgets

| Variant | File bytes | Visible triangles | Stored triangles including patches | Materials | Texture |
|---|---:|---:|---:|---:|---|
| male | 5,782,280 | 28,000 | 59,307 | 2 | One embedded 1024 × 1024 PNG |
| female | 5,796,100 | 28,000 | 59,307 | 2 | One embedded 1024 × 1024 PNG |

Each file contains 58 meshes, but inactive patches should be hidden. Default: one draw call. The four-region pain example uses five. Two independently highlighted muscle regions use three. Enabling every patch would use 58 draw calls and is not the intended mobile mode. The extra 31,307 stored patch triangles avoid duplicating the entire body for each highlight. No compressed-mesh extension or custom shader is required. The roughly 5.8 MB files exceed the earlier 3.2 MB smooth versions because more vertices support the revised anatomical relief and local highlight patches; phone memory and frame-time measurements remain outstanding.

Desktop checks on 2026-10-06: Khronos glTF Validator reported zero errors, warnings or informational issues for both files. Geometry validation sampled five morph settings per variant, with no flipped triangles or nonadjacent below-neck triangle intersections. Patch morph deltas match the body within 0.000000061 meters. Browser picking passed all 230 region/shape/variant checks. The phone previews display the body at approximately 296 pixels high. Visual inspection found no visible limb intersections or border seams in the saved views. This is not proof of every possible slider value, camera angle, or device.

Repository checks are separate: npm install completed without writing the lockfile or running lifecycle scripts. A later typecheck reported syntax errors in the concurrently edited workout timeline file; it was not changed for this task. Expo Doctor results are recorded in `art/body-3d/VALIDATION.md`. Convex codegen/deployment was not run for this asset-only change.
