# Asset validation

Revised asset version 3.0.0 validated 2026-10-06 using Blender 5.2.2 LTS, Khronos glTF Validator 2.0.0-dev.3.10, and the T3 collaborative browser with Three.js standard glTF materials. All machine-readable reports are bound to the SHA-256 hashes in `assets/body-3d/manifest.json`.

## Results

- Both final GLBs: zero Khronos errors, warnings, or informational messages. See `gltf-validation.json`.
- Each GLB was imported into a fresh Blender scene. All 58 meshes, the embedded 1K image, standard materials and three named morph targets survived.
- Final triangle-to-region maps are contiguous and complete, with explicit null entries for unlisted anatomy. Every left/right classified triangle has the correct anatomical X sign.
- All patches follow the body at the base, adiposity endpoint, muscularity endpoint, combined endpoint and midpoint. Maximum exported morph-delta mismatch is under 0.000000061 meters; patch normals match the body's normals exactly.
- No flipped or degenerate triangles in the five tested shape settings per variant. Welded, nonadjacent triangle intersection checks below the neck return zero. The check deliberately excludes the head's small facial cavities; it is not a claim of global watertightness. See `geometry-validation.json` and `validate_assets.py`.
- 230 browser picking cases passed: all 23 regions, five shape settings, two variants. Anchors were evaluated using morphed vertices and checked against actual body raycasts.
- Lower-back-only tint changes zero front-view pixels in each variant at all five tested morph settings. Primary-to-secondary role changes on the same quadriceps mesh change visible pixels. Two simultaneous muscle patches render with three draw calls, including the body. See `browser-validation.json`.
- Front, back, side and oblique views, all endpoint shapes, combined settings, pain examples, simultaneous muscle highlights and phone-size views are saved under `assets/body-3d/previews/`. The 288 × 360 phone renders display a body about 296 pixels high on `#121110`.
- The Blender Studio source was refined and reduced to one shared 28,000-triangle topology. Local armpit deformation restraint removes folds at combined fullness/muscularity. A small toe splay preserves toe separation. Smooth forearm rotation exposes the hands obliquely; reduced pectoral, abdominal and upper-arm relief avoids the previous protruding muscle bumps. Coverage and highlights follow the same deformation.
- Both final file hashes agree across the manifest and validation reports.
- The original Blender scene still contains its original Cube, Camera and Light. Source work ran in separate background processes.

These are desktop asset checks. No Android device, Expo GL renderer, device memory consumption or frame-time budget was tested. Visual review and sampled geometry checks cannot prove every continuous morph value and viewing angle.

## Prior repository checks, separate from the anatomy revision

The required `npm install` was run with `--package-lock=false --ignore-scripts --no-audit --no-fund`. It refreshed local `node_modules`; this task did not edit package manifests or the lockfile.

An early typecheck passed. The later `npm run typecheck`, during concurrent workspace work, reported syntax errors at lines 838, 839 and 917 of `components/workout/workout-timeline-page.tsx`. That file was not edited by this task. Application integration is outside this handoff.

The final `npm run doctor` passed 19 of 22 checks. It reported duplicate installed `react-native-screens` versions, a `react-native-screens` version mismatch, and an Expo/Hermes regression advisory. No dependency upgrades or native app changes were made to resolve those reports. These app checks were recorded during the original 2026-10-05 asset work; the anatomy revision does not change app code. The dependency install itself refreshed installed versions without writing the lockfile.

Convex codegen and deployment were not run. This task changes assets and authoring tools only, and the installed codegen command uploads backend functions. No backend schema or application screen was changed. Nothing was committed or pushed.
