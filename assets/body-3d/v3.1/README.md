# Reed bodies v3.1

This is an authored revision of v3.0, not a runtime correction. The original GLBs, manifests, delivery alternatives and `art/body-3d/reed-bodies.blend` remain unchanged at their original paths. `art/body-3d/contract-v3.0.json` preserves the original authoring contract.

Changes: separate left/right biceps and triceps discomfort regions and patches; softly edged, low-contrast fitted coverage; continuous matte clay on the female back. Body geometry and its three morph targets retain the existing topology. Each variant now has 27 discomfort regions, 34 muscle patches and 62 meshes including the continuous body.

This directory preserves v3.1. The app now uses [v3.2](../v3.2/README.md), which fixes torso/arm region leakage. V3.1 delivery used **only** `compressed/male.glb.gz` and `compressed/female.glb.gz`. Use `compressed/original-gzip.json` for delivery hashes and `manifest.json` for decoded hashes, final triangle runs, anchors, aliases and morphs. Gzip restores the canonical GLB byte for byte. No Meshopt decoder is required.

The delivery pair is 5,997,232 bytes versus 11,670,164 bytes for these canonical GLBs (48.6% smaller as loose files). This is not an APK/AAB saving measurement: package compression may already compress the GLBs. Native builds and device checks were explicitly excluded by the user.

## Archived source

The current builder generates v3.2. To re-export this preserved v3.1 release, open `art/body-3d/reed-bodies-v3.1.blend` and run `export_assets.py` into a separate output directory. The exporter reads `contract-v3.1.json`. Do not run the current source builder over the archived scene. Use the [v3.2 instructions](../v3.2/README.md) for new builds.
