# Reed bodies v3.3

This revision refines the saved v3.2 male and female meshes. It does not rebuild,
remesh, decimate or replace either body. Front and side silhouette edits soften
the scapular projection, chest/abdomen and ribcage/waist transitions, lumbar/glute
curve, shoulder insertions, hip, thigh and calf contours. Fingers receive a
subtle palmward relaxation. Facial identity, ground contact, height, UVs, triangle
topology, source IDs and anatomical region membership are retained.

The source is `art/body-3d/reed-bodies-v3.3.blend`. The original v3.2 source and
all earlier scenes/assets remain intact. The active contract is
`art/body-3d/contract.json`; the previous contract is archived as
`art/body-3d/contract-v3.2.json`.

The refinement processes Basis, adiposity, muscularity and the actual combined
endpoint, then reconstructs `fullness_corrective`. Every hidden highlight patch
is refitted from exact source vertex IDs. Export transfers continuous-body
normals to patch borders and regenerates the final triangle picking map.

The app imports only this revision's `compressed/male.glb.gz` and
`compressed/female.glb.gz`. Gzip restores the canonical GLBs byte for byte;
`compressed/original-gzip.json` and `manifest.json` carry their integrity hashes.
Each variant still has 28,000 visible triangles, 27 discomfort regions and 34
muscle patches. There is no added rig or animation in this asset revision.

## Reproduce the refinement

Run from the repository root with the installed Blender executable. This loads
the existing meshes; the older `build_bodies.py` is only the v3.2 foundation
builder and must not be used to produce v3.3.

```sh
blender --background art/body-3d/reed-bodies-v3.2.blend --python art/body-3d/refine_bodies.py -- --output art/body-3d/reed-bodies-v3.3.blend --report assets/body-3d/v3.3/refinement.json
blender --background --python art/body-3d/validate_refinement.py -- --source art/body-3d/reed-bodies-v3.2.blend --revised art/body-3d/reed-bodies-v3.3.blend --output assets/body-3d/v3.3/refinement-validation.json
blender --background art/body-3d/reed-bodies-v3.3.blend --python art/body-3d/export_assets.py -- --output assets/body-3d/v3.3
blender --background --python art/body-3d/validate_assets.py -- --input assets/body-3d/v3.3 --source art/body-3d/reed-bodies-v3.3.blend
node art/body-3d/compress_assets.mjs --input assets/body-3d/v3.3 --gzip-only
```

`render_silhouettes.py` renders orthographic front, side and back views of a saved
scene without modifying it. Use `--appearance onboarding` to inspect fullness
.4 with muscularity 1, matching the onboarding default.

Validation reports check unchanged source structure, surface symmetry, morph
endpoints, nonadjacent intersections, patch correspondence/normals and fresh
Blender reimport. Runtime GLTFLoader tests cover lossless loading, hidden patch
morph weights and all 27 discomfort pick regions. These checks do not establish
rig deformation quality, native runtime performance or APK/AAB size savings.
