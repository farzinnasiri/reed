# Reed bodies v3.4

This revision changes anatomical region membership and derived highlights on
the saved v3.3 models. The continuous body's indices, positions, normals, UVs
and all three morph buffers remain byte-identical to v3.3. The refined
silhouettes are retained; no sculpting, remeshing or foundation rebuild occurs.

Discomfort has 45 independent surface locations. Front/back/inner thighs,
shins/calves, front/back knees, feet/heels and lateral hips/glutes/groin are
separate. Anterior lower abdomen belongs to abdomen. Forearms, wrist joints and
hands are distinct; forearm muscle highlights exclude wrist and hand surfaces.
Pain labels describe locations, rather than diagnosing the underlying muscle.
Exercise highlights remain independent, with 34 muscle patches.

Membership uses the shared source geometry and remains fixed through morphing.
Leg front/back boundaries follow the limb cross-section centerline, rather than
the normal of a local muscle bump. The exporter regenerates picking runs and
anchors from the final triangles, refits hidden patches by source vertex ID and
copies continuous-body normals to patch borders.

The app imports only this revision's gzip pair. Each body has 28,000 visible
triangles and 80 meshes including inactive patches; default rendering still uses
one body draw call. Direct surface hits take priority over neighboring anchors.
The existing 22px allowance remains available when a tap misses the silhouette.

All older Blender sources and delivery revisions are preserved. Source:
`art/body-3d/reed-bodies-v3.4.blend`. Active contract:
`art/body-3d/contract.json`; previous contract: `contract-v3.3.json`.

## Reproduce

Run from the repository root with the installed Blender executable:

```sh
blender --background art/body-3d/reed-bodies-v3.3.blend --python art/body-3d/partition_regions.py -- --output art/body-3d/reed-bodies-v3.4.blend --report assets/body-3d/v3.4/region-partition.json
blender --background art/body-3d/reed-bodies-v3.4.blend --python art/body-3d/export_assets.py -- --output assets/body-3d/v3.4
blender --background --python art/body-3d/validate_assets.py -- --input assets/body-3d/v3.4 --source art/body-3d/reed-bodies-v3.4.blend
node art/body-3d/compress_assets.mjs --input assets/body-3d/v3.4 --gzip-only
npx tsx --test tests/body-3d.test.ts
```

`render_silhouettes.py --pain right_forearm` inspects a single authored patch in
orthographic views without modifying the saved source. Workbench inspection
shows patch boundaries; runtime additionally applies vertex-alpha feathering.

Validation checks fresh Blender reimport, five appearance combinations,
nonadjacent intersections, hidden patch morphs/normals, lossless delivery,
all 45 pick regions, separate muscle roles, patch clearing and direct abdomen
hits near hip/arm anchors. See `geometry-validation.json`,
`source-comparison.json`, `region-partition.json` and
`compressed/compression-validation.json`. Native runtime performance and
APK/AAB sizes are not measured by these checks.
