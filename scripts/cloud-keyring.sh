#!/bin/sh
# Claude cloud sessions only: a keyring for `void deploy`'s Cloudflare sign-in. void stores the
# sign-in in the system keyring and refuses to without one; a cloud session (Linux) has none.
# Run by the SessionStart hook in .claude/settings.json, and by scripts/deploy.sh (it restarts the
# keyring if it has stopped). On a Mac, a desktop or a server, which
# have their own keyring, it does nothing.
[ "$CLAUDE_CODE_REMOTE" = "true" ] && [ "$(uname)" = "Linux" ] || exit 0

dir=/tmp/void-keyring
mkdir -p "$dir"
sudo=""
[ "$(id -u)" = "0" ] || sudo="sudo -n"

if ! command -v gnome-keyring-daemon > /dev/null; then
  $sudo apt-get install -y -q gnome-keyring > "$dir/apt.log" 2>&1 ||
    { $sudo apt-get update -q > /dev/null 2>&1 && $sudo apt-get install -y -q gnome-keyring >> "$dir/apt.log" 2>&1; } ||
    { echo "cloud-keyring: installing gnome-keyring failed ($dir/apt.log)"; exit 0; }
fi

# A session bus with an unlocked keyring, started once and reused while it's running.
alive() { [ -f "$dir/env" ] && (. "$dir/env" && dbus-send --session --print-reply --dest=org.freedesktop.secrets /org/freedesktop/secrets org.freedesktop.DBus.Peer.Ping > /dev/null 2>&1); }
if ! alive; then
  # The keyring file stays on disk, always with this password, so a restarted daemon still has
  # the sign-in: this environment stops background programs between an agent's turns.
  address=$(dbus-daemon --session --fork --print-address=1 | head -n 1)
  echo "export DBUS_SESSION_BUS_ADDRESS='$address'" > "$dir/env"
  (. "$dir/env" && printf 'void' | gnome-keyring-daemon --unlock --components=secrets > /dev/null 2>&1)
fi

# Every later command in the session gets the bus (scripts/deploy.sh also reads $dir/env).
[ -n "$CLAUDE_ENV_FILE" ] && cat "$dir/env" >> "$CLAUDE_ENV_FILE"
echo "cloud-keyring: ready for void deploy"
