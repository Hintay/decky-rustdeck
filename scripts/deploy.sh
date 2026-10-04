#!/bin/bash
# Build the plugin and copy it into Decky on a Steam Deck over SSH (root), then start Decky again.
# Usage: scripts/deploy.sh [root@host]
set -euo pipefail

DECK=${1:-root@steamdeck.local}
NAME=RustDeck
DEST=/home/deck/homebrew/plugins/$NAME
cd "$(dirname "$0")/.."

pnpm run build >/dev/null
# Stop Decky before touching the plugin dir: its hot reload would load the half-copied plugin.
# plugin_loader.service uses KillMode=process: when a plugin does not exit on stop, systemd kills
# only the launcher and the loader itself is left behind (parent 1), file watcher and all. Such
# orphaned loaders are ended with their plugin processes, children first: Decky's plugin socket
# spins without bound once the process at its other end is gone.
# Options before the operands: macOS bsdtar reads a trailing --exclude as a file name.
COPYFILE_DISABLE=1 tar --no-xattrs --exclude='__pycache__' -czf - plugin.json package.json main.py LICENSE dist py_modules assets/artwork \
  | ssh "$DECK" "systemctl stop plugin_loader \
      && for p in \$(pgrep -f '^Decky Loader '); do \
           [ \"\$(ps -o ppid= -p \$p | tr -d ' ')\" = 1 ] || continue; \
           pkill -9 -P \$p; kill -9 \$p; done; \
      { pkill -f '^$NAME \\($DEST/main.py\\)' || true; } \
      && rm -rf $DEST && mkdir -p $DEST && tar -xzf - -C $DEST && chown -R root:root $DEST \
      && systemctl start plugin_loader && echo deployed to $DEST"
