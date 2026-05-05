# PRD: User and Workout Information Architecture

Status: needs-triage

## Problem Statement

Reed currently gives primary navigation weight to Settings, while the product needs a more meaningful User destination. Settings is utility chrome, not a product surface. The user needs a place to understand and correct their athlete identity: body status, goals, Training Profile, and top records.

The Workout surface also needs to grow beyond starting a Live Session without becoming a noisy archive or analytics dashboard. Users need access to previous sessions, ended Session Insights, weekly Training Knowledge, Records, Routines, and future Plans, but the root Workout surface must stay fast and simple because Reed is workout-first.

Without a clear information architecture, Home, Workout, User, and future Reed AI risk duplicating concepts and calculations. Body data, goals, records, sessions, and weekly load could appear in inconsistent places with inconsistent meaning.

## Solution

Replace the Settings tab with a User tab while keeping the primary navigation as `Home · Workout · Reed · User`. The User surface becomes an athlete profile: a quiet, inspectable summary of who Reed understands the user to be. Settings moves behind a gear on the User surface.

Refine the Workout surface into a training command center. The root stays action-first: start/continue training, then progressively reveals Routines, a compact weekly summary, Records preview, and recent sessions. Detailed history, filters, weekly insights, ended Session Insights, Records, Routines, and Plans live one layer deeper.

Use Training Knowledge as the shared meaning layer for dashboards and future Reed AI. User owns identity and status. Workout owns training work. Reed uses both. Home chooses the next action.

## User Stories

1. As a Reed user, I want bottom navigation to show User instead of Settings, so that my profile feels like a meaningful product destination.
2. As a Reed user, I want Settings behind a gear on the User page, so that account utilities do not dominate the product.
3. As a Reed user, I want to see my name and training context on the User page, so that I understand how Reed sees me.
4. As a Reed user, I want to see my current bodyweight and trend, so that I can understand body status without opening a chart.
5. As a Reed user, I want to open body details from the User page, so that I can inspect or update measurements when needed.
6. As a Reed user, I want to see my current goal and priorities, so that I remember what my training is oriented around.
7. As a Reed user, I want to see my Training Profile summary, so that I can verify Reed has accurate constraints, equipment, and training preferences.
8. As a Reed user, I want to edit or review my Training Profile from User, so that Reed can adapt around correct context.
9. As a Reed user, I want to see a small Records preview on User, so that my athlete identity includes what I have achieved.
10. As a Reed user, I want full settings to remain available, so that account, notifications, units, privacy, sign out, and deletion are still easy to find.
11. As a Reed user, I want User to feel personal and calm, so that it does not feel like an admin panel.
12. As a Reed user, I want User empty states to explain what data Reed needs, so that missing body or profile data feels actionable.
13. As a Reed user, I want body composition and weight data to live under User, so that status data is separate from training work.
14. As a Reed user, I want Workout to start with Start or Continue Session, so that the main training action is always obvious.
15. As a Reed user with an active Live Session, I want Workout to show Continue Session first, so that I can return to logging immediately.
16. As a Reed user without an active Live Session, I want Workout to offer Start Session first, so that I can begin training without decisions.
17. As a Reed user, I want Workout to show Routines without making them more important than starting training, so that reusable training is discoverable but not distracting.
18. As a Reed user, I want future Plans to be visible as a quiet placeholder, so that I understand where planned training will live later.
19. As a Reed user, I want a compact weekly training summary on Workout, so that I can understand this week at a glance.
20. As a Reed user, I want weekly details hidden one layer deeper, so that the Workout root stays simple.
21. As a Reed user, I want to navigate previous weeks, so that I can compare recent training history.
22. As a Reed user, I want the weekly donut and legend to use the same totals as the top summary, so that I trust the numbers.
23. As a Reed user, I want weekly load labels to be clear about distributed muscle contribution, so that I do not confuse muscle distribution with raw activity totals.
24. As a Reed user, I want Records preview on Workout, so that performance progress is visible without opening a full dashboard.
25. As a Reed user, I want full Records grouped by training type, so that strength, bodyweight, cardio, and holds are easy to scan.
26. As a Reed user, I want to tap a Record to see its history, so that I understand when and how it changed.
27. As a Reed user, I want recent sessions on Workout, so that I can quickly reopen what I did recently.
28. As a Reed user, I want only a few recent sessions on the root, so that history does not overwhelm training.
29. As a Reed user, I want a View All sessions entry, so that I can access full history when needed.
30. As a Reed user, I want a paginated previous sessions list, so that long-term training history stays performant and navigable.
31. As a Reed user, I want filters for previous sessions hidden by default, so that common browsing stays simple.
32. As a Reed user, I want filters for date, Exercise, modality, and Records, so that I can find specific sessions when I need detail.
33. As a Reed user, I want ended Session Insights, so that I can understand what a completed Workout Session meant.
34. As a Reed user, I want ended Session Insights to emphasize meaning before raw replay, so that I get useful feedback quickly.
35. As a Reed user, I want the ended Session Insights experience to feel consistent with Live Session insights, so that I do not learn a new model.
36. As a Reed user, I want raw sets available lower down, so that detailed session review is possible without dominating the page.
37. As a Reed user, I want Routines to support repeating common patterns, so that I can train faster when I know what I want.
38. As a Reed user, I want Plans to remain quieter until implemented, so that the app does not promise fake capability.
39. As a Reed user, I want Workout to feel like a command center, so that it helps me train rather than browse analytics.
40. As a Reed user, I want Home to remain focused on today's next action, so that it does not become another dashboard.
41. As a Reed user, I want Reed AI to rely on the same Training Knowledge as the UI, so that answers match dashboards.
42. As a Reed user, I want body, goals, and constraints to inform Reed AI, so that coaching feels personalized and accurate.
43. As a Reed user, I want Reed to answer questions about previous weeks and Records, so that I can learn from my history without manual analysis.
44. As a Reed user, I want data freshness and missing data states to be clear, so that I know when Reed is reasoning from limited information.
45. As a Reed user, I want all major rows to be tappable with clear labels, so that the app works well one-handed and under fatigue.
46. As a Reed user, I want charts to have text legends, so that I can understand data without relying only on color.
47. As a Reed user, I want page hierarchy to stay spare and premium, so that Reed feels focused rather than like a generic fitness dashboard.
48. As a Reed user, I want deep pages to exist only when they carry real value, so that the product stays simple.

## Implementation Decisions

- Keep primary navigation as `Home · Workout · Reed · User`.
- Replace Settings as a primary tab with User.
- Move Settings behind a gear inside User.
- Treat User as the athlete profile surface, not an account settings surface.
- User owns body status, body measurements, goals, constraints, Training Profile summary, and a Records preview.
- Workout owns Live Session entry, Routines, Plans, weekly training summary, Records, previous sessions, and ended Session Insights.
- Home remains a lightweight next-action surface rather than becoming the full training dashboard.
- Reed AI will be a caller of Training Knowledge, not a separate owner of calculations.
- Training Knowledge remains the shared product meaning layer for weekly summaries, body trends, performance comparisons, and future Reed tool calls.
- Workout root must stay action-first: Continue Session or Start Session appears before history, analytics, or library surfaces.
- Previous sessions live behind Recent Sessions / View All, not on the root by default.
- Session filters are progressively disclosed in a sheet or secondary control.
- Ended Session Insights reuse the Live Session Insights concepts but shift copy toward post-session meaning.
- Weekly Insights are navigable by week and reuse the same summary math as Home and Training Knowledge.
- Records are previewed on both User and Workout, but full Records belong under Workout.
- Body status belongs under User and is referenced by Workout only when training interpretation needs it.
- Routines are discoverable on Workout; Plans are quieter until real implementation exists.
- Use fewer glass cards, with glass reserved for action/insight surfaces that need depth.
- Avoid page-chrome formulas such as generic oversized title plus subtitle on every screen.
- Charts must not create mismatched totals between summary and legend.
- Accessibility labels are required for settings gear, rows, week navigation, filters, and charts.

## Testing Decisions

- No test runner is introduced by this PRD unless explicitly approved later.
- Good tests should exercise external behavior at module Interfaces, not internal implementation details.
- Training Knowledge is the best future test surface because Home, Workout, and Reed all depend on the same meaning.
- Session History should be validated through paginated Convex query behavior and UI state expectations.
- Ended Session Insights should be validated against the same data semantics used by Live Session Insights.
- Weekly Insights should be validated for total consistency between summary metrics, donut center value, and legend values.
- Records should be validated once the PR ledger exists; until then, avoid brittle tests around read-time approximations.
- Accessibility should be checked manually for tap target size, chart text fallback, row labels, and filter state announcement.

## Out of Scope

- Building Reed AI conversation behavior.
- Building actual generated Plans.
- Building a full Routine authoring system.
- Implementing a materialized PR ledger, unless split into a separate PRD.
- Building body composition import integrations.
- Changing authentication or account management infrastructure.
- Adding broad analytics dashboards to Home.
- Adding visible advanced filters to the Workout root.
- Reintroducing tests in this PRD without explicit approval.

## Further Notes

This PRD intentionally favors information architecture and product hierarchy over feature breadth. The product should expose depth only when users ask for it. The Workout root should make training feel immediate; User should make Reed's understanding inspectable; Reed should eventually use both through constrained Training Knowledge tools.

Important product rule: User owns identity/status, Workout owns training work, Reed uses both, Home chooses next action.
