# Reed's first launch

Three transparent cutouts are used by `components/launch/first-launch-intro.tsx`:

- `shoe.png` — 320 × 199.
- `snowboard.png` — 193 × 320.
- `kettlebell.png` — 235 × 320.

Generated on 2026-10-06 with the built-in `image_gen` tool, with `transparent_background: true`. A single sprite sheet was cropped into the three independent objects and resized with Sharp; its original alpha was preserved. No background was painted behind the cutouts. The runtime uses only these small assets, totaling about 280KB.

Prompt:

> Use case: stylized-concept. Asset type: a transparent sprite sheet for the first-launch animation of Reed, a serious dark fitness coaching app. Exactly THREE independent sports equipment cutouts on a genuinely transparent background, arranged in three equally sized columns, generous clear spacing, no overlap. Left: a pale warm-gray sculptural running shoe with a small cobalt blue outsole accent, seen in three-quarter side view with toe pointing right. Middle: a pale warm-gray snowboard with visible two simple bindings, tilted diagonally 20 degrees clockwise, a subtle cobalt blue thin edge stripe. Right: one pale warm-gray compact kettlebell with a small cobalt blue handle accent, three-quarter view. Consistent matte clay and technical sports illustration style, softly lit from upper left, dimensional without glossy chrome. Large simple forms readable at 80 pixels on a warm black background. All objects completely inside their own column. The shoe and kettlebell can be similar visual mass; board fits vertically. No floor, no cast shadow, no background rectangle, no text, no logos, no labels, no people, no confetti. Crisp clean antialiased silhouettes, genuine alpha transparency. These three objects will drift around a smiling black orb mascot and then gather inward.

The app mark is **not generated art**. `scripts/render-app-icons.ts` exports the happy expression directly from Reed's mascot engine. Run `npx tsx scripts/render-app-icons.ts` to regenerate the native icons, splash, monochrome notification mark, web favicon and Apple touch icons. Sharp is a development dependency only.

Replay the introduction at `https://reed.localhost/onboarding-v2?intro=1`. Replay does not change the device's saved launch flag. Normal first-time visits mark it seen after completion or skipping. Reduce Motion bypasses the orbit and goes straight to the welcome screen.

Native icon and splash changes require a new standalone app build. Web uses the assets immediately, subject to the browser's favicon cache.
