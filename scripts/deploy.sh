#!/bin/bash
# Build the plugin and copy it into Decky on a Steam Deck over SSH (root), then start Decky again.
# Usage: scripts/deploy.sh [root@host]
set -euo pipefail

DECK=${1:-root@steamdeck.local}
NAME=RustDeck
DEST=/home/deck/homebrew/plugins/$NAME
cd "$(dirname "$0")/.."

pnpm run build >/dev/null
# Stop Decky before touching the plugin dir: its hot reload would load the half-copied plugin, and
# plugin_loader.service uses KillMode=process, so plugin processes of an old loader can outlive a
# restart (holding its port). Hence also the explicit kill of this plugin's processes.
# Options before the operands: macOS bsdtar reads a trailing --exclude as a file name.
COPYFILE_DISABLE=1 tar --no-xattrs --exclude='__pycache__' -czf - plugin.json package.json main.py LICENSE dist py_modules assets/artwork \
  | ssh "$DECK" "systemctl stop plugin_loader \
      && { pkill -f '^$NAME \\($DEST/main.py\\)' || true; } \
      && rm -rf $DEST && mkdir -p $DEST && tar -xzf - -C $DEST && chown -R root:root $DEST \
      && systemctl start plugin_loader && echo deployed to $DEST"
