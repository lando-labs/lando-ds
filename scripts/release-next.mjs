// Manual prerelease publisher — cuts a snapshot build to the npm `next`
// dist-tag, mirroring the manual `latest` flow (see reference/releasing.md).
//
// What it does:
//   1. build a fresh dist/
//   2. `changeset version --snapshot next` → stamps an ephemeral version like
//      `0.59.0-next-<datetime>` (calculated from pending changesets) and writes
//      CHANGELOG entries; this also CONSUMES (deletes) the changeset files
//   3. `changeset publish --tag next --no-git-tag` → publishes to the `next`
//      dist-tag with NO git tag (prereleases don't get tags)
//   4. ALWAYS restore the working tree — the version bump and the consumed
//      changesets are ephemeral and must never be committed. `main` stays at
//      its stable version and the changesets survive for the eventual stable
//      release.
//
// Requires an interactive npm login (same as the manual `latest` publish);
// this is deliberately NOT wired into CI. Run on a clean working tree.
import { execSync } from 'node:child_process'

const run = (cmd) => execSync(cmd, { stdio: 'inherit' })

try {
  run('npm run build')
  run('npx changeset version --snapshot next')
  run('npx changeset publish --tag next --no-git-tag')
} finally {
  // Discard the ephemeral snapshot bump + un-delete the consumed changesets,
  // regardless of whether publish succeeded. Runs even on failure so a broken
  // publish never leaves a half-versioned tree behind. `git restore` on
  // unchanged files is a no-op, so this is safe if an earlier step failed.
  run('git restore .changeset package.json CHANGELOG.md')
}
