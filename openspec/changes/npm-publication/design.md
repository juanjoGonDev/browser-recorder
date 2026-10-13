# Design: npm publication and package verification

## Technical Approach

Reuse the package shape already produced by `scripts/build.ts`, and adapt only
the publish/pack concepts from Fastypest. Keep pnpm for checkout builds, but use
npm to install the tarball because npm is the registry's target consumer. Run
that install from a unique prefix beneath `RUNNER_TEMP`, not from a child of the
checkout, and launch the installed global bin with a version-only command so no
browser can open.

Use a `files` allowlist with `dist/`; npm automatically includes the root
`package.json`, README, and license. Change Git hook setup from `postinstall` to
`prepare`: local repository setup still gets its hooks, but the registry
tarball does not invoke a TypeScript source script under `node_modules`.
Preserve the installer guard for local/ git-directory installs and CI.

Add a separate Ubuntu package job to `ci.yml` rather than widening the
cross-platform test matrix or the static Quality job. It builds, packs,
inspects, and globally installs the tarball in an external temporary prefix.
The manual npm workflow repeats that verification; a dry run is the default,
and the publish job is owner/default-branch guarded and protected by the
existing `admin` environment. The npm token is mapped only into the publish
step, and duplicate versions are rejected before the publish command.

Adapt the manual Patchright recovery hint to use `npm exec -y -p patchright@<pinned>
-- patchright ...`. This avoids claiming a `patchright` shim exists in an npm
global install; npm only links the package's declared top-level bin. Keep the
patch version in one shared domain constant and test it against
`package.json#dependencies.patchright`.

## Frozen Contract Reconciliation

The active `repository-quality` spec has a general “version untouched” scenario
for workflow/tooling changes. That scenario predates npm publication and
conflicts with the frozen repository rule that package-surface changes require
a semantic version bump. This design takes precedence for the publishing
change: `private`, `files`, lifecycle metadata, and consumer-facing recovery
commands change the published package contract, so the patch version advances
from `0.1.1` to `0.1.2`. Reconcile the active spec so release-neutral workflow
changes remain version-neutral while publish-surface changes follow the release
impact policy. The separate replay-alias requirement is not changed.

## Security and Operational Decisions

| Topic | Decision | Rationale |
|---|---|---|
| Trigger | Manual `workflow_dispatch` | Makes the first release an explicit maintainer action; existing GitHub Release flow is left unchanged |
| Dry run | Boolean, default true | Default behavior cannot publish |
| Trust | Repository owner, default branch, protected `admin` environment | Keeps publishing from untrusted refs and centralizes npm credential protection |
| Credential | `NPM_AUTH_TOKEN` environment secret, injected only at publish | Adapt Fastypest's existing token contract without exposing it to install/build steps |
| Provenance | `npm publish --provenance`; `id-token: write` exists only in the gated publish job | Publishes npm's GitHub Actions build attestation without granting OIDC access to package validation |
| Consumer verification | `npm install --global --prefix <temp> <tarball>` + installed `--version` | Exercises the actual npm global-bin layout in a root with no checkout or pnpm config |
| Package contents | `files: ["dist"]` plus npm's required metadata/readme/license | Excludes tests, source, specs, workflows, and development tool configs |

## Test Strategy

- RED: repository tests assert package publish metadata, prepare lifecycle,
  external-root package CI, and safe publish workflow contracts.
- GREEN: update the manifest, shared Patchright commands, docs, and workflows.
- Integration: pack and install from a unique temporary global prefix with
  npm lifecycle scripts enabled; run only `browser-recorder --version`.
- Quality: run focused Vitest tests first, then `pnpm quality`,
  `pnpm test:coverage`, `pnpm build`, and release validation checks.

## Rollback

Revert the package metadata/lifecycle/docs/tests/workflow set as one change.
No registry action is performed by the patch itself; the publish action is a
separate protected workflow dispatch.
