#!/bin/sh
# Claude cloud sessions only (a Mac or a developer's machine is left alone). It gives the session
# what a developer's machine already has, so Claude runs the same `vp` commands they do:
#   - the Vite+ CLI (`vp`), which installs the Node in .node-version and the pnpm in package.json;
#   - a system keyring, where `void` keeps the Cloudflare sign-in (a cloud session has none).
# Run by .claude/settings.json at the start of a session and before each prompt: this environment
# stops background programs between turns, so the keyring is restarted when it has stopped.
[ "$CLAUDE_CODE_REMOTE" = "true" ] && [ "$(uname)" = "Linux" ] || exit 0

vp_bin="$HOME/.local/share/vite-plus/bin"
dir=/tmp/void-keyring
bus="unix:path=$dir/bus"
mkdir -p "$dir"
sudo=""
[ "$(id -u)" = "0" ] || sudo="sudo -n"

# Vite+, installed the way its docs say (https://viteplus.dev/guide/global-cli), in managed mode.
if [ ! -x "$vp_bin/vp" ]; then
  curl -fsSL https://vite.plus | bash > "$dir/vp-install.log" 2>&1 &&
    "$vp_bin/vp" env on >> "$dir/vp-install.log" 2>&1 ||
    echo "cloud-session: installing Vite+ failed ($dir/vp-install.log)"
fi

if ! command -v gnome-keyring-daemon > /dev/null; then
  $sudo apt-get install -y -q gnome-keyring > "$dir/apt.log" 2>&1 ||
    { $sudo apt-get update -q > /dev/null 2>&1 && $sudo apt-get install -y -q gnome-keyring >> "$dir/apt.log" 2>&1; } ||
    echo "cloud-session: installing gnome-keyring failed ($dir/apt.log)"
fi

# A session bus at a fixed address, with an unlocked keyring. The keyring file stays on disk with
# the same password, so a restarted keyring still has the sign-in.
if ! DBUS_SESSION_BUS_ADDRESS="$bus" dbus-send --session --print-reply --dest=org.freedesktop.secrets \
  /org/freedesktop/secrets org.freedesktop.DBus.Peer.Ping > /dev/null 2>&1; then
  rm -f "$dir/bus"
  dbus-daemon --session --fork --address="$bus" > /dev/null
  printf 'void' | DBUS_SESSION_BUS_ADDRESS="$bus" gnome-keyring-daemon --unlock --components=secrets > /dev/null 2>&1
fi

# At session start: every later command gets vp on its PATH and the keyring's bus.
if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo "export PATH=\"$vp_bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
  echo "export DBUS_SESSION_BUS_ADDRESS='$bus'" >> "$CLAUDE_ENV_FILE"
fi
