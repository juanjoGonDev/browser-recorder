#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temporary_root="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
workspace_root="${GITHUB_WORKSPACE:-$repository_root}"

mkdir -p "$temporary_root"
cd "$repository_root"

package_name="$(node -p "require('./package.json').name")"
package_version="$(node -p "require('./package.json').version")"
if [[ "$package_name" != 'browser-recorder' ]]; then
  echo "Unexpected npm package name: $package_name" >&2
  exit 1
fi

tarball="$temporary_root/${package_name}-${package_version}.tgz"
consumer_root="$(mktemp -d "$temporary_root/browser-recorder-consumer.XXXXXX")"
consumer_real="$(realpath "$consumer_root")"
workspace_real="$(realpath "$workspace_root")"
if [[ "$consumer_real" == "$workspace_real" || "$consumer_real" == "$workspace_real/"* ]]; then
  echo 'The consumer install root must be outside the source checkout.' >&2
  exit 1
fi
if [[ -e "$consumer_root/.git" || -e "$consumer_root/node_modules" ]]; then
  echo 'The consumer install root must start without Git metadata or dependencies.' >&2
  exit 1
fi

pnpm pack --pack-destination "$temporary_root" > /dev/null
if [[ ! -f "$tarball" ]]; then
  echo "Expected packed tarball was not created: $tarball" >&2
  exit 1
fi

archive_listing="$consumer_root/package-files.txt"
tar -tzf "$tarball" > "$archive_listing"
unexpected_files="$(grep -Ev '^package/(dist/.*|package\.json|README\.md|LICENSE)$' "$archive_listing" || true)"
if [[ -n "$unexpected_files" ]]; then
  echo 'The npm package contains files outside its explicit allowlist:' >&2
  printf '%s\n' "$unexpected_files" >&2
  exit 1
fi

for required_file in \
  package/package.json \
  package/README.md \
  package/LICENSE \
  package/dist/main.js \
  package/dist/in-page/capture-script.js; do
  if ! grep -Fxq "$required_file" "$archive_listing"; then
    echo "Required npm package file is missing: $required_file" >&2
    exit 1
  fi
done

if grep -Eq '^package/(src|tests|openspec|\.github|scripts)/' "$archive_listing"; then
  echo 'The npm package contains repository-only files:' >&2
  grep -E '^package/(src|tests|openspec|\.github|scripts)/' "$archive_listing" >&2
  exit 1
fi

tar -xOf "$tarball" package/package.json > "$consumer_root/package.json"
node --input-type=commonjs - "$consumer_root/package.json" <<'NODE'
const fs = require('node:fs');
const packageJson = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (packageJson.private === true) throw new Error('The package is private.');
if (packageJson.scripts?.postinstall) {
  throw new Error('The published package must not define a postinstall hook.');
}
NODE

cd "$consumer_root"
publish_log="$consumer_root/npm-publish-dry-run.log"
if ! npm publish --dry-run --access public "$tarball" > "$publish_log" 2>&1; then
  cat "$publish_log" >&2
  exit 1
fi
tail -n 8 "$publish_log"
npm install --global --prefix "$consumer_root" --no-audit --no-fund --ignore-scripts=false "$tarball"

cli="$consumer_root/bin/browser-recorder"
if [[ -x "$cli" ]]; then
  installed_version="$("$cli" --version)"
elif [[ -f "$consumer_root/browser-recorder.cmd" ]]; then
  cli="$consumer_root/browser-recorder.cmd"
  installed_version="$("$cli" --version | tr -d '\r')"
else
  echo "The npm global binary was not installed: $cli" >&2
  exit 1
fi

if [[ "$installed_version" != "$package_version" ]]; then
  echo "Installed CLI reports $installed_version; expected $package_version." >&2
  exit 1
fi

printf 'Installed browser-recorder@%s in clean external root %s\n' \
  "$installed_version" "$consumer_root"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'tarball=%s\n' "$tarball" >> "$GITHUB_OUTPUT"
fi
