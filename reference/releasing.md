# Releasing `@lando-labs/lando-ds`

Releases are managed with [Changesets](https://github.com/changesets/changesets). There are two channels:

- **`latest`** — stable releases (`0.58.0`, `0.59.0`, …). What `npm install @lando-labs/lando-ds` gets.
- **`next`** — prereleases (`0.59.0-next-<datetime>`). Opt-in via `npm install @lando-labs/lando-ds@next`.

> **Publishing is automated via npm OIDC trusted publishing.** Both `@lando-labs/lando-ds` and `@lando-labs/lando-ds-meta` have a trusted publisher on npmjs.com pointing at `.github/workflows/release.yml`, so CI publishes with a short-lived OIDC token (no long-lived `NPM_TOKEN`) and emits provenance attestations automatically. `v0.57.0`/`v0.58.0` were hand-published *before* this was configured, so they carry no attestations; releases from `v0.59.0` on are CI-published with provenance. The manual steps below remain valid as a fallback.

Every change that should appear in a release needs a changeset:

```bash
npx changeset            # pick bump level, write a summary → commits a .md under .changeset/
```

---

## Stable release (`latest`)

1. Land feature PRs to `main`, each carrying its changeset.
2. On merge, the release workflow opens a **"Version Packages" PR** that bumps `package.json` + writes `CHANGELOG.md`.
   - ⚠️ Until **Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"** is enabled, the workflow can push the `changeset-release/main` branch but **not** open the PR — open it by hand from that branch (`gh pr create --base main --head changeset-release/main --title "Version Packages"`).
3. Review + merge the Version Packages PR (`main` is now at the new version).
4. Publish from `main`:
   ```bash
   git checkout main && git pull
   npm whoami                 # confirm you're logged in with publish rights
   npm run release            # build + changeset publish → publishes to `latest` AND creates the vX.Y.Z git tag
   git push origin vX.Y.Z     # push the tag changeset just created
   ```
5. Create the GitHub Release (until CI does it):
   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z — …" --verify-tag --latest --notes "…"
   ```

## Prerelease (`next`)

Cut an opt-in preview from a branch that has **pending (unreleased) changesets** — e.g. to let a consumer try a sprint before it goes stable. Requires the same npm login as above.

```bash
npm run release:next
```

This (see [`scripts/release-next.mjs`](../scripts/release-next.mjs)):

1. builds a fresh `dist/`,
2. stamps an ephemeral **calculated** version like `0.59.0-next-<datetime>` from the pending changesets,
3. publishes it to the **`next`** dist-tag with **no git tag**, and
4. **restores the working tree** — the version bump and consumed changesets are never committed.

So `main` stays at its stable version, the changesets survive for the eventual stable release, and the stable pipeline is completely untouched. Consumers opt in with:

```bash
npm install @lando-labs/lando-ds@next
```

Snapshot behavior is configured under `snapshot` in [`.changeset/config.json`](../.changeset/config.json) (`useCalculatedVersion: true` so the version reflects the real upcoming release rather than `0.0.0`).

---

## CI publishing (OIDC trusted publishing)

Configured. Merging the "Version Packages" PR runs `.github/workflows/release.yml`, which:

1. upgrades npm to ≥ 11.5.1 (OIDC support),
2. runs `npm run release` → publishes `@lando-labs/lando-ds` to `latest` with provenance (short-lived OIDC token, no `NPM_TOKEN`), creates the git tag + GitHub Release, then
3. (gated on a real publish) assembles and publishes `@lando-labs/lando-ds-meta` the same way.

So only **changeset authoring** and **merging the two PRs** stay manual. If OIDC ever fails, the manual `latest`/meta steps above are the fallback.

**To change or add a trusted publisher** (npmjs.com → package → Settings → Trusted Publisher): GitHub Actions → `lando-labs/lando-ds` → workflow filename **`release.yml`** (exact match — `.yml`, not `.yaml`) → allowed action **npm publish** → no environment. The `next` prerelease channel is manual and unaffected.
