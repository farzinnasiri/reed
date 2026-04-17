# Reed — Product Vision

*Personal trainer OS. Not the app kind.*

---

## The Core Provocation

"Personalised" usually means one of three lazy things: your name in the header, a few recommendations, or a coach that remembers your past chats. That is not personalised software. That is the same app with better CRM.

A truly personalised app changes its *shape*, not just its content.

Reed stops behaving like a fitness app and starts behaving like a living training environment built around how *this specific person* changes. The UI is not a fixed container with tabs. It is an adaptive instrument panel whose structure, language, pacing, and level of visibility evolve with the user.

---

## Foundational Principles

### The app builds a deep model of the person, not just their stats

It learns training goal, injury history, discipline, self-image, motivation style, relapse patterns, schedule volatility, boredom threshold, preferred feedback tone, and what actually causes compliance. Two users both trying to cut fat should not see remotely the same product.

### The interface changes based on behavioural type

A disciplined bodybuilder might get a sparse command-center: today's split, load targets, recovery flags, one strategic note. A chaotic beginner with avoidance patterns might get a softer, more guided interface: one next action, zero clutter, more reassurance, fewer metrics. Same engine, different surface.

### The app reveals complexity only when earned

Most products dump the full ontology on day one: workouts, analytics, macros, trends, streaks, zones, splits, history. Reed unfolds. At first it may feel almost empty. As the user demonstrates competence, curiosity, and consistency, new layers emerge — but always at the pace the user's behaviour suggests they are ready for.

---

## Ideas

### 1. The App Has a Personality. So Do You. They Should Clash Productively.

What if Reed has a coherent character that is not just a passive assistant? One that has opinions, gets frustrated when you quit, pushes back when you lie to yourself, celebrates weirdly, and occasionally is sarcastic? And the relationship between Reed's personality and your personality creates friction that generates compliance?

Not a chatbot. A training relationship with a point of view.

Some users would bond with a brutal Reed. Others would ghost one that challenges them. The app should choose who it becomes based on who it needs to be for you. A soft person who avoids conflict might get a Reed that is more blunt and confrontational. A perfectionist who beats themselves up might get a Reed that is steadying and reassurance-first.

*The friction between personalities is the product.*

### 2. The App Watches What You Do, Not What You Say You Do

Most apps track workouts and meals. What if Reed tracks everything:

- When you open the app
- When you close it without acting
- What you skip
- How long you spend on the progress screen vs. the planning screen
- When you engage after a streak breaks
- The lag between intent and action

This is not surveillance. It is behavioural signal. The app learns that you always fall off on week three. That you open the app six times before you actually train. That you respond to social proof in week one but it makes you anxious by week six.

This data reshapes the product in real-time. Not a weekly report. Not a monthly review. Real-time.

### 3. The Body as a System, Not a Dashboard

Current apps treat the body like a video game character: HP (body-fat %), XP (strength), quests (workouts). Reed treats it like a complex adaptive system. It surfaces second-order effects: "Your sleep debt is making your CNS recovery shit. The heavy squat you planned will likely make next week's deadlift worse. Here is the adjusted plan."

It does not just track macros. It tracks how your food choices affect your next-day decision quality. It does not just log lifts. It correlates them with your reported mood, energy, and libido over months. The UI becomes a control panel for an organism instead of a scoreboard.

### 4. Identity-Level Training

Most people fail because their identity and their training are in conflict. Reed makes identity the primary variable. It forces you to write (or speak) the story of who you are becoming, then designs training that reinforces that story at the level of daily micro-behaviours.

The app remembers the exact language you used when you were most committed and feeds versions of it back to you at the right moments. It treats motivation as a renewable resource that can be engineered, not a random weather event.

### 5. Anti-Coaching (The Deliberate Removal of the Coach)

The deepest personalisation is knowing when to get the hell out of the way. Reed has an "absence protocol": after a certain streak or competence threshold, the UI simplifies to almost nothing. One line. One metric. No motivational copy. The product literally fades until you need it again.

Most apps do the opposite — they get louder when you succeed. Reed does the inverse. That silence becomes part of the brand.

### 6. The Fork in the Road Engine

Every 4–6 weeks Reed deliberately creates controlled divergence. It presents two completely different training philosophies or lifestyle bets and forces you to choose. Not A/B test. A real fork.

One path is conservative and high-compliance. The other is aggressive and high-variance. The app then optimises hard for the path you picked and uses the data to refine its model of what kind of player you actually are. Over a year you end up on a trajectory no generic program could have produced.

### 7. Memory as a Feature

Reed maintains a private, evolving "training memoir" written in your own voice (or close to it). Every major lesson, failure, and breakthrough gets distilled into short, brutal sentences that the app re-surfaces at the exact moment they are most likely to hit.

It is not a journal you write in. It is a mirror the product holds up to the version of you that has already been through this.

This is where the "truly personalised" technical challenge gets solved: the memoir and the behavioural model become the persistent kernel. The UI and features are generated on top of it. Updates to the product are updates to the generator, not the instance. Your Reed and someone else's Reed are different codebases by year two.

### 8. The Anti-Social Social Layer

Instead of leaderboards (which destroy most people), Reed has a "witness layer." You can opt in to let a very small number of chosen people see your actual struggle in near-real time — not polished highlights, but the raw pattern of when you skip, when you lie to the app, when you come back.

The witnesses do not comment. They just witness. The psychological effect is surprisingly strong. Reed gamifies honesty instead of performance.

---

## The Technical Edge

Most personalised software fails because the personalisation is a layer on top of a static product. When the product updates, the update applies uniformly to everyone. The personalisation instance does not survive the product evolution.

Reed's architecture solves this: the behavioural model and memoir are the persistent runtime. The UI, features, and logic are generated on top of them. When Reed ships a new capability, it is injected into the generator — and every user's instance gets it applied in a way compatible with their specific model.

The product evolves. The person does not get reset.
