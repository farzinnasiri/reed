# Reusable body viewer

`BodyViewer` loads one male/female asset, supports horizontal rotation and returns anatomical discomfort picks. The onboarding uses the previously selected sex; other/private retains the neutral illustration because no neutral GLB was delivered.

Pass `appearance: { adiposity, muscularity }` with independent 0–1 weights. Every mesh, including hidden patches, receives `[adiposity, muscularity, adiposity * muscularity]`. These controls describe the figure; they do not claim a calibrated body-fat percentage.

Pass `highlights: { pain, primary, secondary }`. Pain keys use the manifest region IDs and intensity 1–4; omit/remove a key to clear it. Primary/secondary accept canonical muscle IDs or catalog aliases. Primary wins overlaps; unknown/unrepresented groups are ignored. Roles have independent materials and never change selection. Empty inputs show no patches. Colours and opacities live in `design/system.ts`.

Native controls own selection/intensity; the Expo DOM component owns WebGL and binary loading. Hash verification precedes parsing. Appearance/highlight updates reuse the loaded scene. Rendering is on demand, pixel ratio is capped, and GPU resources are released on unmount.

Delivery/source instructions: `assets/body-3d/v3.4/README.md`. The separate body playground has been removed. Onboarding supplies the prior sex and shape, fixes muscularity to 1, and uses a right-side vertical severity rail plus a rotation button. No extra figure, fullness or muscle controls appear there. Browser checks do not establish native WebView performance or APK size savings.
