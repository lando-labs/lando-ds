# Changesets

Hello and welcome! This folder has been set up for [`@changesets/cli`](https://github.com/changesets/changesets),
a tool that manages versioning and changelogs. Even though this is a **single-package** repo
(`@lando-labs/lando-ds`), Changesets still gives us reviewable, per-change release notes and an
automated "Version Packages" PR.

Full docs: <https://github.com/changesets/changesets>
Common questions: <https://github.com/changesets/changesets/blob/main/docs/common-questions.md>

## How we use it

1. **Author a changeset with your PR.** Run `npm run changeset` (alias for `changeset`), pick the bump
   level (`patch` / `minor` / `major`), and write a short human summary. This writes a Markdown file
   into `.changeset/`. Commit it alongside your code.
2. **Merging to `main` opens a "Version Packages" PR.** The `.github/workflows/release.yml` workflow
   aggregates all pending changesets, bumps `version` in `package.json`, and updates `CHANGELOG.md`.
3. **Merging the "Version Packages" PR publishes.** The same workflow then builds a fresh `dist/` and
   runs `changeset publish` to the public npm registry, and creates the GitHub Release + git tag.

> **This pipeline is DORMANT in this private repo.** The `release.yml` job is guarded to run only in the
> public OSS snapshot `lando-labs/lando-ds`. In this private repo, releases continue to publish to
> GitHub Packages via `.github/workflows/publish.yml`. See
> `reference/public-launch/go-live-checklist.md` for the human go-live runbook.
