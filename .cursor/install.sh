#!/usr/bin/env bash
set -euo pipefail

NODE_BIN="${HOME}/.nvm/versions/node/v22.22.2/bin"
if [ ! -x "${NODE_BIN}/node" ]; then
  echo "Node 22.22.2 is required at ${NODE_BIN} so rslint can load TypeScript config." >&2
  exit 1
fi

for cmd in node npm npx corepack; do
  sudo ln -sfn "${NODE_BIN}/${cmd}" "/usr/local/cargo/bin/${cmd}"
  sudo ln -sfn "${NODE_BIN}/${cmd}" "/usr/local/bin/${cmd}"
done

hash -r

if ! command -v pnpm >/dev/null 2>&1 || [ "$(pnpm -v)" != "12.10.1" ]; then
  corepack prepare pnpm@12.10.1 --activate
fi

if [ ! -e /usr/local/bin/pnpm ]; then
  sudo ln -sfn "$(readlink -f "$(command -v pnpm)")" /usr/local/bin/pnpm
fi

pnpm install --frozen-lockfile
