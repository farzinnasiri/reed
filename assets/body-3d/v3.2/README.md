# Reed bodies v3.2

This revision fixes torso highlights containing inner-arm and forearm triangles. The anatomical selection field is now separate from the conservative arm deformation mask. Both region picking and pain/muscle patches are regenerated from those source labels. No runtime remapping or patch clipping is used.

The original v3.0 and v3.1 assets and Blender scenes remain intact. The new source is `art/body-3d/reed-bodies-v3.2.blend`; its archived contract is `art/body-3d/contract-v3.2.json`. Geometry and morph shapes are unchanged; region membership, patches and coverage membership were regenerated.

The app bundles only `compressed/male.glb.gz` and `compressed/female.glb.gz`. `compressed/original-gzip.json` provides delivery hashes; `manifest.json` provides the decoded contract, final triangle runs, anchors and muscle aliases. Gzip restores the canonical GLB byte for byte. Each variant has 27 discomfort regions, 34 muscle patches and 62 meshes including the continuous body.

Onboarding chooses the model from the previous sex answer, uses the earlier body-shape answer for relative fullness (default .4), and fixes muscularity at 1. These are appearance weights, not calibrated percentages. No shape/muscle sliders or gender switcher are shown on the discomfort page.

## Rebuild

Run from the repository root, using the installed Blender executable:

```sh
blender --background --python art/body-3d/build_bodies.py -- --output art/body-3d/reed-bodies-v3.2.blend
blender --background art/body-3d/reed-bodies-v3.2.blend --python art/body-3d/export_assets.py -- --output assets/body-3d/v3.2
blender --background --python art/body-3d/validate_assets.py -- --input assets/body-3d/v3.2 --source art/body-3d/reed-bodies-v3.2.blend
node art/body-3d/compress_assets.mjs --input assets/body-3d/v3.2 --gzip-only
```

Explicit output paths preserve older scenes. The exporter selects the contract matching the scene version and rejects mismatches. Do not reorder final triangles after export. Source re-import/deformation checks are in `geometry-validation.json`; lossless delivery checks are in `compressed/compression-validation.json`.

Browser validation does not establish Android runtime performance or APK/AAB savings. No native build or emulator is required for this change.
