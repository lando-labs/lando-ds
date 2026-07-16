# Contributing to Lando DS

Thanks for your interest in the Lando Labs Design System. This guide covers
the essentials for working in the repository.

## Code of conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). By
participating you agree to uphold it; report unacceptable behavior to
<lando@landolabs.co>.

## Prerequisites

- Node.js `>=20`
- npm (the repo ships a `package-lock.json`)

## Setup

```bash
npm ci
```

`npm ci` runs the `prepare` lifecycle, which builds the library into `dist/`
(the build is not committed — it is rebuilt on demand by `prepare` and by
publish CI).

## The gate

Every change must pass the same checks CI runs, in this order:

```bash
npm run typecheck     # tsc --noEmit (strict, noUncheckedIndexedAccess)
npm run lint          # eslint, zero warnings
npm test -- --run     # vitest
npm run build         # vite library build + emit tokens/meta + unlayered CSS
npm run sync-docs     # regenerate COMPONENTS.md + CLAUDE.md generated regions
```

CI additionally validates the emitted `dist/meta.json` against the versioned
schema package (`npm run validate:meta`) and type-checks a real consumer of the
packed tarball (`examples/consumer-smoke`). Do not pipe these commands through
`tail`/`grep` to judge pass/fail — check each command's exit code directly.

## Conventions

- **Components** are CSS-Modules + design tokens, fully typed, with a
  `*.test.tsx` beside them. See [`reference/component-authoring.md`](./reference/component-authoring.md).
- **Design decisions** that affect the public API are documented under
  [`reference/`](./reference).
- **Docs counts** (component inventory, test coverage) are generated — never
  hand-edit the regions between `GENERATED` markers; run `npm run sync-docs`.
- **Commits**: keep them scoped and atomic. Sprint work uses a
  `[scope] type: description (Refs: #NN)` convention.

## Pull requests

Open PRs against `main`. The full gate above must be green. Include a short
summary of what changed and which issues it closes.

## Maintainers

Lando DS is maintained by [@Lando8604](https://github.com/Lando8604)
(<lando@landolabs.co>). Pull requests automatically request review via
[`.github/CODEOWNERS`](./.github/CODEOWNERS).

This is a small team, so calibrate expectations accordingly: a response usually
takes a few days, and a polite bump on the thread is welcome if something looks
missed. Changes to the public component API, the design-token contract, or the
`meta.json` schema get extra scrutiny — they ripple out to every consumer *and*
to the AI agents grounding on the metadata. For anything large, open an issue to
discuss the approach before investing in the PR.

## Security

Please report security concerns responsibly — see [`SECURITY.md`](./SECURITY.md).
Open a private advisory rather than a public issue for anything sensitive.

## License

By contributing, you agree that your contributions are licensed under the
project's [Apache License 2.0](./LICENSE), and you confirm you have the right to
submit them under that license (Apache-2.0 §5).
