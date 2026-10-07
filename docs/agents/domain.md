# Domain Docs

How engineering skills should consume this repo's domain documentation.

## Before exploring, read this

- **`CONTEXT.md`** at the repo root. Use its vocabulary.

This repo has no ADRs. Do not create `docs/adr/` or an ADR unless a decision was actually resolved and someone is recording it on purpose. A missing ADR folder is not a gap to fill while exploring.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, note the gap. Do not invent a parallel term, and do not open an ADR to paper over it.

If an ADR is added later and your output contradicts it, say so explicitly.
