# Workout Image Reference

This directory contains the production reference for generated workout imagery.

- `reference-front-rack-hold.png` is the first single-movement visual target.
- `reference-snatch-pull.png` is the second single-movement visual target.
- `prompt-template.md` is the reusable prompt for generating one exercise image from one exported CSV row.

The intended output is a mobile-safe first frame for a future movement video:
full body visible, complete equipment visible, pure white background, no text,
and red/orange muscle activation overlays.

Every generated workout image should contain exactly one movement and one figure.
Do not create stacked sheets, split panels, labels, captions, badges, or movement
sequences. Use a fixed `1080x1920` portrait output size.
