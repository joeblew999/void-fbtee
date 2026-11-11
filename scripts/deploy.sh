#!/bin/sh
# Deploy the example to Cloudflare with `void deploy`, the same on a Mac and in a Claude cloud
# session. The first deploy in a session prints Cloudflare's sign-in link (the code is in it):
# open it on any device and click Allow.
set -e
cd "$(dirname "$0")/../apps/example"
# In a Claude cloud session: the keyring, (re)started (background programs don't outlive a turn).
if [ "$CLAUDE_CODE_REMOTE" = "true" ]; then
  CLAUDE_ENV_FILE= sh ../../scripts/cloud-keyring.sh > /dev/null
  . /tmp/void-keyring/env
fi
# void's sign-in needs a terminal; with none (an agent's shell), `script` gives it one (Linux).
if [ -t 0 ] || [ "$(uname)" != "Linux" ]; then
  exec pnpm exec void deploy --platform cloudflare "$@"
fi
exec script -qfec "pnpm exec void deploy --platform cloudflare $*" /dev/null
