# Releasing `@lando-labs/lando-ds`

Releases are managed with [Changesets](https://github.com/changesets/changesets). There are two channels:

- **`latest`** — stable releases (`0.58.0`, `0.59.0`, …). What `npm install @lando-labs/lando-ds` gets.
- **`next`** — prereleases (`0.59.0-next-<datetime>`). Opt-in via `npm install @lando-labs/lando-ds@next`.

> **Publishing is currently manual.** The CI publish path in `.github/workflows/release.yml` is wired for a `NPM_TOKEN` secret that is not yet configured, so a maintainer with npm publish rights publishes by hand (as was done for `v0.57.0` and `v0.58.0`). Manually-published builds have **no provenance attestations** — those appear once CI publishing (automation token or OIDC) is set up. Until then, expect the release workflow to fail at the publish step on merges to `main`; that failure is benign.

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

## Once CI publishing is configured

Add an npm **automation** token as the `NPM_TOKEN` repo secret (bypasses 2FA-on-publish), *or* set up npm **trusted publishing (OIDC)** for the package (no long-lived token; the workflow already requests `id-token: write` and sets `NPM_CONFIG_PROVENANCE`). Then the stable flow above becomes fully automatic on merge — build → publish (with provenance) → tag → GitHub Release — and only the changeset authoring stays manual.
