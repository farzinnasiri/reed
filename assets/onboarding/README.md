# Onboarding artwork

Created with the built-in imagegen tool on 2026-10-04. No CLI/API fallback was used.

- `body-atlas-v2.png`: active transparent atlas, 1024×1536. Two columns (front/back), three rows (male/female/neutral). Figure choice follows the earlier sex answer; regions and pain tint overlays are code-owned in `pain-map.tsx`.
- `body-atlas.webp`: superseded opaque concept, retained as source artwork only.
- `coach-note.webp`: original transparent charcoal envelope concept. Retained as source artwork; the letter now uses separate animated SVG layers in `steps-letter.tsx`.

These are illustrations, not clinical anatomy or body-composition evidence. The body atlas intentionally uses average clothed figures. Figure choice does not change profile sex.

## Body atlas prompts

Initial successful generation:

> Create a transparent six-figure fitness illustration atlas for selecting sore areas in a sports app. Exactly 3 equal columns and 2 equal rows, generous transparent margins between figures. Top row same ADULT MAN age 35 in FRONT, BACK, RIGHT-FACING SIDE views. Bottom row same ADULT WOMAN age 35 in FRONT, BACK, RIGHT-FACING SIDE views. ALL FIGURES FULLY CLOTHED IN FITTED SHORT-SLEEVE GRAY ATHLETIC T-SHIRTS AND KNEE-LENGTH GRAY ATHLETIC SHORTS. Average realistic build, not bodybuilders. Neutral standing, arms relaxed slightly away from body, feet apart, entire bodies including feet visible. Bald simplified featureless gray heads. Light warm gray sculpted sports illustration with soft matte shading, clean silhouette, distinguishable joint contours, no fine anatomical detail. Equal scale and consistent posture across views, heads and feet aligned within each row. No labels, no text, no dots, no ground, no shadow, no background. Genuine transparency. For a dark premium app; figures need to be light gray enough to be legible.

Edge-cleanup edit:

> Clean this exact six-figure fitness atlas. Keep all six fully clothed adult figures in exactly the same positions, scale and front/back/side orientation. Change the rendering to clean simplified smooth warm-gray sculptural silhouettes. Remove ALL white fringes, white speckles, ragged edges, noise, floor shadows and loose pixels around every figure. Each silhouette must have a perfect clean antialiased edge on genuine transparency. No added elements or labels. Preserve gray shirts and knee-length shorts, poses, overall anatomy and 3-column 2-row arrangement.

Final edit of the superseded concept:

> Make the background of this exact atlas perfectly solid uniform #121110 dark warm black, opaque, edge to edge. Keep all six clothed adult fitness figures and their exact positions and sizes. Eliminate ALL white speckles, stray pixels and halos outside the figures by replacing them with the background color. Give the gray figures clean, simplified, smooth silhouette edges. Same male front back side top row, female front back side bottom row. No checkerboard, no noise, no ground, no shadow, no text, no changes to poses or clothes. This is an app sprite atlas.

Final generated source: `exec-6cb96089-3539-4547-9576-1113bb21cf1e.png`. Converted to WebP at quality 88, retaining 1312×1199 dimensions. The earlier transparent outputs had edge artefacts and are not shipped.

## Coach note prompt

> Use case: stylized-concept. Asset type: transparent cutout for Reed fitness app's personal welcome letter. A single compact folded note made from thick charcoal-black uncoated paper, viewed straight on with just enough perspective to see the top flap lifting open toward the viewer. Under the flap a very narrow vivid cobalt-blue inner paper edge. Dark warm graphite tones with tactile subtle paper fibers, precise folded creases. The note feels like a personal message handed over by a coach, quietly intriguing and premium. Nearly square composition, one object centrally isolated, large clean transparent margins. No text, no lettering, no logos, no wax seal, no pen, no desk, no cast shadow, no background. Matte dark paper, clearly readable edge lighting suitable for a nearly black #121110 app canvas. Not a shiny envelope icon and not a cartoon. Realistic material in a restrained sculptural illustration. Actual transparent background.

Generated source: `exec-e61f3776-437e-480e-b3dc-734ea18fe4dc.png`. Converted to WebP at quality 85 and width 448, preserving transparency.

## Transparent replacement atlas

Generated with the built-in imagegen tool, then edited with that same tool for background extraction. The PNG is copied directly from the generated output, without manual background removal.

Generation brief: exactly two columns and three rows of full-body, clothed, grayscale adult figures. Front and back for an average man, an ordinary woman with softer proportions and tied-back hair, and a neutral figure. Consistent matte shading, relaxed arms separated from the torso, feet visible, no labels or floor shadows.

Final edit prompt:

> Background extraction only. Cut out the SIX clothed gray figures from this exact image. Remove EVERY part of the gray/black background and ALL glow/gradient around the figures. Replace all space outside the exact figure silhouettes with fully transparent alpha, including gaps between arms and torso and between legs. Keep the figures, faces, clothing, proportions, front/back orientation, exact positions and sizes unchanged. Do not render any new light or shadow. No halo, no fringe. Only the six gray human silhouettes should remain as pixels, with clean antialiased edges on genuine transparency. This will be placed over a colored app background which must show uninterrupted everywhere outside the bodies.

Generated source: `exec-4d999c70-8125-471b-b712-4c80dd56fe9f.png`. Alpha-channel inspection confirmed transparent pixels around and between figures; browser review confirmed the page canvas shows through.
