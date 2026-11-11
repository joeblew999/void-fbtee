#!/bin/sh
# Claude cloud sessions only (a Mac or a developer's machine is left alone). It gives the session
# what a developer's machine already has, so Claude runs the same commands they do:
#   - Vite+'s global `vp` (https://viteplus.dev/guide/global-cli), managing the Node in .node-version;
#   - a system keyring, where `void` keeps the Cloudflare sign-in (a cloud session has none).
# Run by .claude/settings.json at the start of a session and before each prompt: this environment
# stops background programs between turns, so the keyring is restarted when it has stopped.
[ "$CLAUDE_CODE_REMOTE" = "true" ] && [ "$(uname)" = "Linux" ] || exit 0

dir=/tmp/void-keyring
bus="unix:path=$dir/bus"
mkdir -p "$dir"
sudo=""
[ "$(id -u)" = "0" ] || sudo="sudo -n"

# Vite+'s global vp, as a developer installs it, with Node managed from .node-version (`vp env on`).
vpbin="$HOME/.local/share/vite-plus/bin"
if [ ! -x "$vpbin/vp" ]; then
  curl -fsSL https://vite.plus | bash > "$dir/vp.log" 2>&1 ||
    echo "cloud-session: installing Vite+ failed ($dir/vp.log)"
fi
"$vpbin/vp" env on > /dev/null 2>&1

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

# At session start: every later command gets vp (and its Node) on its PATH and the keyring's bus.
if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo ". \"$HOME/.config/vite-plus/env\"" >> "$CLAUDE_ENV_FILE"
  echo "export DBUS_SESSION_BUS_ADDRESS='$bus'" >> "$CLAUDE_ENV_FILE"
fi
