# Workout Image Prompt Template

Use this prompt for one exercise at a time. Inject one row from
`exports/workout_image_prompt_data.csv` into the `Exercise row` section.

```text
Use case: scientific-educational
Asset type: mobile workout exercise image, canonical frame for future movement video

Primary request:
Create one production-quality exercise anatomy image for the exercise described
below. The image must look like a clean instructional movement-video frame:
stable, readable posture; full body visible; complete equipment visible; and
enough safe margin for mobile display. The image must contain exactly one
movement and exactly one figure.

Exercise row:
{{EXERCISE_ROW}}

Scene/backdrop:
Pure white seamless background. No gym environment, no wall, no floor line, no
panel border, no labels, no UI, no captions, no arrows, no badge, no watermark.
Use only a very soft grounding shadow if needed to make the figure readable.

Subject:
One athletic adult anatomical figure performing the exercise from a clear
three-quarter view. Use the exercise row to determine equipment, body position,
movement pattern, laterality, load type, and target muscles. Show the most
recognizable canonical frame of the exercise, not a passive rest/top/lockout
position. For squats, lunges, hip thrusts, hinges, rows, curls, crunches, raises,
pulls, and machine exercises, choose a frame where the movement is visually
obvious and the target muscles are under tension. Use the literal start frame
only when the start position itself clearly communicates the movement or the
exercise is an isometric hold.

Style/medium:
Semi-realistic grayscale anatomical fitness illustration, matching classic
exercise anatomy references. The figure should have visible grayscale muscle
forms and red/orange translucent activation overlays on the primary and
secondary target areas from the exercise row. Keep the anatomy detailed but not
grotesque or medical-dissection-like.

Composition/framing:
Fixed `1080x1920` portrait image. Center the figure. Keep the entire body,
hands, feet, and all required equipment fully inside the frame. Leave generous
safe margins on all sides so the image can be cropped by mobile UI without
cutting off body parts or equipment. Do not include text. Do not create a split
panel, stacked sheet, before/after sequence, or multi-frame movement diagram.
For wide movements such as lateral raises, flyes, face pulls, rows, and barbell
lifts, reduce figure scale or use a diagonal three-quarter camera angle so hands,
handles, dumbbells, plates, and bar ends do not touch or cross the image edge.

Figure identity:
Use a generic athletic adult male anatomical figure with a softer oval face,
subtle stubble, short textured dark hair with a low fade, and a neutral focused
expression. Do not use the bald or buzz-cut model from older samples. Keep the
identity generic and non-celebrity.

Lighting/mood:
Bright clinical studio lighting, neutral, precise, educational.

Color palette:
Pure white background, grayscale figure and equipment, controlled red/orange
muscle activation only.

Materials/textures:
Matte grayscale anatomical body, simple black/gray shorts if needed, clean
steel or black exercise equipment, subtle anatomy shading.

Constraints:
No text of any kind. No logos. No watermark. No panel borders. No extra people.
No second movement. No stacked layout. No split panels. No movement sequence. No
decorative background. No exaggerated bodybuilding pose unless required by the
exercise. Accurate equipment and grip. Accurate first-frame posture. Avoid
cropped limbs, cropped plates, hidden hands, distorted fingers, wrong grip
width, incorrect equipment, excessive shadows, blood, gore, and medical
dissection styling.

Common failure guards:
- Do not show squats, split squats, goblet squats, or smith squats standing
  upright; show visible hip and knee flexion.
- Do not show Romanian deadlifts or good mornings at lockout; show the hinge.
- Do not show bent-over rows, seated rows, face pulls, crunches, curls, leg
  raises, or pushdowns at passive rest; show the contraction or most readable
  working phase.
- Do not highlight quads for hamstring-dominant exercises such as seated leg
  curls, lying leg curls, Nordic curls, or Romanian deadlifts.
- Do not highlight abs/quads as the main target for glute-dominant exercises
  such as hip thrusts.
- For chin-up variants, make the supinated underhand grip unmistakable when the
  exercise says chin-up.
- For machine exercises, show the machine mechanics that define the exercise
  such as knee/thigh pads for seated calf raises and assistance pad for assisted
  chin-ups.
```
