# Coach models and live settings

The final coach reply uses OpenRouter through the existing LangChain `ChatOpenAI` adapter and `createAgent` workflow. `convex/aiModelProvider.ts` owns the HTTP contract; callers use a LangChain model, including its tool binding interface. Context retrieval, image analysis, coach state, and memory retain their existing independent models. This change does not introduce an orchestration framework or run all three reply models together.

## Change the active model

`globalSettings` contains one indexed `global` record. `aiSettings.get` requires the viewer's authenticated profile and contains no secrets. Both clients subscribe through their conversation hooks, so Convex pushes updates. The backend independently reads `aiSettings.load` once at the beginning of each turn. Updates apply to the next turn; in-flight work retains its snapshot. Langfuse records the settings revision, requested model, reasoning, completion budget, and routing policy.

Only deployment operators can write settings, through internal functions in the Convex dashboard or CLI:

```sh
npx convex run --deployment dev aiSettings:setCoachReply '{"model":"z-ai/glm-5.3-flash"}'
# Alternatives, one at a time:
# npx convex run --deployment dev aiSettings:setCoachReply '{"model":"deepseek/deepseek-v4.1-flash"}'
# npx convex run --deployment dev aiSettings:setCoachReply '{"model":"minimax/minimax-m3"}'
npx convex run --deployment dev aiSettings:load '{}'
```

Selecting a model loads its complete preset. To tune it, pass the complete `settings` object returned by `load`, together with `model` and optionally `expectedRevision`. A stale revision is rejected. For example, set `settings.reasoning.effort` to `high` or `max` for GLM/DeepSeek. `coachReplyPreset` in `convex/aiSettingsValues.ts` owns defaults. An uninitialized deployment resolves to GLM; run `setCoachReply` to persist its initial record.

`coachReplyBackup` contains the backup's complete preset, including its own reasoning and provider policy. GLM and MiniMax default to DeepSeek as backup; DeepSeek defaults to GLM. Existing records without this optional stored field resolve the same default when read. Configure both choices atomically:

```sh
npx convex run --deployment dev aiSettings:setCoachReply '{"model":"z-ai/glm-5.3-flash","backupModel":"deepseek/deepseek-v4.1-flash"}'
```

Pass `backupSettings` with `backupModel` to tune its complete preset. Primary and backup must differ. Changing only the primary preserves the saved backup unless that would select the same model; then the default different backup is used. Settings retain revision checking and authenticated subscriptions.

## Reply recovery

Each turn makes at most three application attempts: primary, primary again, then backup once. SDK retries are disabled. Each attempt has a 90-second abort deadline; a 900ms delay separates attempts. OpenRouter can also try another allowed hosting provider within each request, using its existing [provider routing policy](https://openrouter.ai/docs/guides/routing/provider-selection).

HTTP errors, timeouts, empty replies, unusable response envelopes and exhausted token budgets all count as failed attempts. A usable reply with malformed optional presentation metadata can still be recovered by the parser. Every attempt uses the same prompt and the settings snapshot taken at the start of the turn. Backup reasoning and routing come from its own preset. The fallback never changes global settings; the next turn starts with the primary again. Langfuse records the actual model and attempt number for each generation.

After the first failure, the backend marks the existing pending message's `replyRecovery` as `retrying`; after the second it becomes `backup`. The normal authenticated message subscription pushes these updates to home and workout conversations. The mascot's status immediately switches to six authored recovery lines, starting randomly and rotating at the normal waiting cadence. These are UI status copy, not model output or durable coaching messages. No extra chat rows are inserted. Completion, final failure and manual retry clear the recovery state.

After three failed model attempts, the existing chat error and Retry action appear on the same assistant row. Manual Retry starts a fresh three-attempt turn with current settings. Context preparation and reply persistence are outside the generation retry loop, so saving a plan or session proposal cannot be repeated by a model retry.

`REED_CHAT_MODEL` no longer selects the final reply. The other `REED_*_MODEL` environment settings still control their respective steps. Keep `OPENROUTER_API_KEY` server-only in `.env.dev` and the development Convex environment; `make convex-env-push ENV=dev` uploads it. Production requires a separate key/setup and is not configured by this development change.

## API and reasoning contracts

The adapter uses `POST https://openrouter.ai/api/v1/chat/completions`, bearer authentication, and the exact model IDs above. It explicitly disables OpenAI Responses API selection. OpenRouter-specific fields travel in LangChain `modelKwargs`; they are not OpenAI SDK `extra_body` fields.

- GLM 5.3 Flash: reasoning is mandatory; accepts `low`, `high`, `max`. Default: `reasoning: { effort: "low", enabled: true, exclude: true }`.
- DeepSeek V4.1 Flash: accepts `low`, `high`, `max`. Same default request as GLM.
- MiniMax M3: supports reasoning, but exposes neither effort selection nor a reasoning-token budget. Request: `reasoning: { enabled: true, exclude: true }`. Settings reject an effort mode for this model instead of pretending it controls the budget.

Reasoning is billed even when excluded from the visible reply. The default 8,192 completion tokens include reasoning and visible output; the configurable total budget is 4,096–32,768. There is no artificial thinking delay. A trivial request may use only a few reasoning tokens. Empty output and token exhaustion enter the recovery policy above. The existing structured reply parser and persistence remain in the live coach path.

See OpenRouter's [reasoning contract](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens) and [LangChain integration](https://openrouter.ai/docs/guides/community/langchain). The [models API](https://openrouter.ai/api/v1/models) is the source for supported efforts; do not assume every reasoning model supports a numeric budget.

## Provider selection

Research snapshot: 2026-10-06. Throughput numbers below come from OpenRouter's published provider tables; prices and 24-hour uptime were checked against its endpoints API. These are observations, not service guarantees.

| Model | Preferred providers | Published throughput | Live input/output USD per million | Live 24h uptime |
| --- | --- | --- | --- | --- |
| GLM 5.3 Flash | CoreWeave, Fireworks US | CoreWeave 121 tps; Fireworks 52 (published provider aggregate) | CoreWeave $0.15/$0.50; Fireworks US $0.225/$0.75 | CoreWeave 99.95%; Fireworks US 99.86% |
| DeepSeek V4.1 Flash | Relace, Wafer | 69, 74 tps | Relace $0.019474/$1.20; Wafer $0.06/$1.20 | 99.94%, 99.80% |
| MiniMax M3 | Parasail, Novita | 102, 57 tps | $0.30/$1.20 | 99.88%, 99.47% |

Sources: [GLM provider page](https://openrouter.ai/z-ai/glm-5.3-flash), [DeepSeek provider page](https://openrouter.ai/deepseek/deepseek-v4.1-flash), [MiniMax provider page](https://openrouter.ai/minimax/minimax-m3), and their [GLM](https://openrouter.ai/api/v1/models/z-ai/glm-5.3-flash/endpoints), [DeepSeek](https://openrouter.ai/api/v1/models/deepseek/deepseek-v4.1-flash/endpoints), [MiniMax](https://openrouter.ai/api/v1/models/minimax/minimax-m3/endpoints) endpoint metadata.

Routing uses an explicit provider allowlist, sorts by throughput, prefers at least 60 tps, requires support for request parameters, and permits failover within the allowlist. Price ceilings are hard constraints: GLM $0.25/$0.80; others $0.35/$1.30. Baseten was excluded because its published throughput is around the 50 tps boundary. The 60 tps preference is soft: OpenRouter may use a slower allowlisted provider during degraded conditions. It does not guarantee a minimum speed or uptime. Review the allowlist when provider performance changes; no unreviewed provider or alternate model is silently added.

See the [provider routing contract](https://openrouter.ai/docs/guides/routing/provider-selection). Restricting fallbacks trades some availability for bounded cost and known providers.
