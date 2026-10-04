import hashlib
import os
import tempfile
import unittest
from unittest import mock

from rustdeck import installer, paths
from rustdeck.util import Result


def release(tag, published, deb=True, sha=True, draft=False):
    assets = []
    if deb:
        assets.append({"name": "rustdesk-unattended-wayland-1.5.0-x86_64.deb", "browser_download_url": f"https://x/{tag}.deb", "size": 10})
        if sha:
            assets.append({"name": "rustdesk-unattended-wayland-1.5.0-x86_64.deb.sha256", "browser_download_url": f"https://x/{tag}.sha256"})
    return {"tag_name": tag, "published_at": published, "draft": draft, "assets": assets}


class LatestReleaseTest(unittest.IsolatedAsyncioTestCase):
    async def test_newest_deck_release_with_a_deb(self):
        releases = [
            release("deck-1.5.0-1", "2026-10-04T15:19:12Z"),
            release("deck-1.5.0-2", "2026-10-06T00:00:00Z", draft=True),
            release("deck-1.5.0-0", "2026-10-04T15:09:08Z"),
            release("1.5.1", "2026-10-07T00:00:00Z"),
            release("deck-1.5.0-3", "2026-10-08T00:00:00Z", deb=False),
        ]
        with mock.patch.object(installer, "_get_json", return_value=releases):
            rel = await installer.latest_release()
        self.assertEqual(rel.tag, "deck-1.5.0-1")
        self.assertEqual(rel.sha_url, "https://x/deck-1.5.0-1.sha256")

    async def test_none_without_releases(self):
        with mock.patch.object(installer, "_get_json", return_value=[]):
            self.assertIsNone(await installer.latest_release())


class InstallTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        store = os.path.join(self.tmp.name, "store")
        self.patches = [
            mock.patch.object(paths, "STORE", store),
            mock.patch.object(paths, "EXT_DIR", os.path.join(store, "rustdesk")),
            mock.patch.object(paths, "EXT_LINK", os.path.join(self.tmp.name, "extensions", "rustdesk")),
            mock.patch.object(paths, "INSTALLED_JSON", os.path.join(store, "installed.json")),
        ]
        for p in self.patches:
            p.start()
        # The build currently installed.
        os.makedirs(os.path.join(paths.EXT_DIR, "usr"))
        with open(os.path.join(paths.EXT_DIR, "build"), "w") as f:
            f.write("old")

    async def asyncTearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    async def install(self, merge_ok: bool):
        def download(url, dest, progress):
            with open(dest, "wb") as f:
                f.write(b"deb")
            return hashlib.sha256(b"deb").hexdigest()

        async def unpack(deb, root):
            os.makedirs(root)
            with open(os.path.join(root, "build"), "w") as f:
                f.write("new")

        merges = []

        async def fake_run(*args, **kwargs):
            if args[:2] == ("systemd-sysext", "merge"):
                merges.append(args)
                # Only the new build fails to merge; putting the old one back works.
                return Result(0 if merge_ok or len(merges) > 1 else 1, "", "" if merge_ok else "boom")
            return Result(0, "", "")

        rel = installer.Release("deck-1.5.0-9", "https://x/deb", None, 3, "")
        with mock.patch.object(installer, "_download", download), mock.patch.object(installer, "_unpack", unpack), \
                mock.patch.object(installer, "run", fake_run):
            await installer.install(rel)
        return merges

    def build(self) -> str:
        with open(os.path.join(paths.EXT_DIR, "build")) as f:
            return f.read()

    async def test_switches_to_the_new_build(self):
        await self.install(merge_ok=True)
        self.assertEqual(self.build(), "new")
        self.assertFalse(os.path.exists(paths.EXT_DIR + ".previous"))
        self.assertEqual(installer.installed()["tag"], "deck-1.5.0-9")

    async def test_failed_merge_puts_the_previous_build_back(self):
        with self.assertRaises(RuntimeError):
            await self.install(merge_ok=False)
        self.assertEqual(self.build(), "old")
        self.assertFalse(os.path.exists(paths.EXT_DIR + ".previous"))
        self.assertIsNone(installer.installed())
