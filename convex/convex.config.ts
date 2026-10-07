import { defineApp } from 'convex/server';
import { v } from 'convex/values';
import migrations from '@convex-dev/migrations/convex.config.js';

const app = defineApp({ env: { REED_SESSION_ACTOR_PROFILE_IDS: v.optional(v.string()), REED_CHAPTER_GAP_MINUTES: v.optional(v.string()) } });
app.use(migrations);

export default app;
