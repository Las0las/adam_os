# Changesets

This directory is managed by [Changesets](https://github.com/changesets/changesets).
Run `pnpm changeset` to record an intent-to-release; `pnpm version-packages` applies it.

Because the platform is contract-first, **any change to `@lawrence/contracts` is a
versioned event** — a breaking contract change is a major bump and must be justified
by a constitutional contradiction, not convenience.
