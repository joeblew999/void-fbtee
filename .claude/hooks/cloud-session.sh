#!/bin/sh
# Claude cloud sessions only (a Mac or a developer's machine is left alone). It gives the session
# what a developer's machine already has, so Claude runs the same commands they do:
#   - the tools in mise.toml (`mise install`), on the PATH;
#   - a system keyring, where `void` keeps the Cloudflare sign-in (a cloud session has none).
# Run by .claude/settings.json at the start of a session and before each prompt: this environment
# stops background programs between turns, so the keyring is restarted when it has stopped.
[ "$CLAUDE_CODE_REMOTE" = "true" ] && [ "$(uname)" = "Linux" ] || exit 0

dir=/tmp/void-keyring
bus="unix:path=$dir/bus"
mkdir -p "$dir"
sudo=""
[ "$(id -u)" = "0" ] || sudo="sudo -n"

# The tools in mise.toml, as a developer gets them with `mise install`.
cd "$CLAUDE_PROJECT_DIR" && mise trust -q mise.toml && mise install -q > "$dir/mise.log" 2>&1 ||
  echo "cloud-session: mise install failed ($dir/mise.log)"

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

# At session start: every later command gets mise's tools on its PATH and the keyring's bus.
if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo "export PATH=\"$HOME/.local/share/mise/shims:\$PATH\"" >> "$CLAUDE_ENV_FILE"
  echo "export DBUS_SESSION_BUS_ADDRESS='$bus'" >> "$CLAUDE_ENV_FILE"
fi
