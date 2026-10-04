# Fixed locations and names shared by the backend modules.

# Releases of the RustDesk build this plugin installs (unattended-wayland deb plus a .sha256).
RELEASE_REPO = "Hintay/rustdesk"
RELEASE_TAG_PREFIX = "deck-"
RELEASE_ASSET_PREFIX = "rustdesk-unattended-wayland-"

# RustDesk refuses its CLI settings unless it runs from under /usr (`is_installed()`), and the
# SteamOS rootfs is read-only, so it is overlaid onto /usr as a systemd-sysext. /var is tiny on
# SteamOS, so the payload lives on /home and only a symlink sits in the sysext search path.
STORE = "/home/.rustdeck"
EXT_NAME = "rustdesk"
EXT_DIR = f"{STORE}/{EXT_NAME}"
EXT_LINK = f"/var/lib/extensions/{EXT_NAME}"
INSTALLED_JSON = f"{STORE}/installed.json"

RUSTDESK = "/usr/bin/rustdesk"
# Absolute paths a RustDesk process is started from; used to anchor process matching.
RUSTDESK_EXES = ("/usr/bin/rustdesk", "/usr/share/rustdesk/rustdesk")

# Transient systemd unit running the root `rustdesk --service`.
SERVICE_UNIT = "rustdeck-rustdesk"
