import asyncio
import contextlib
import importlib
import json
import logging
import os
import sys
import tempfile
import types
import unittest
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class PluginTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        # A stand-in for the module Decky's loader provides.
        self.decky = types.SimpleNamespace(
            DECKY_PLUGIN_SETTINGS_DIR=self.tmp.name,
            DECKY_PLUGIN_DIR=ROOT,
            logger=logging.getLogger("test"),
            emit=mock.AsyncMock(),
        )
        sys.modules["decky"] = self.decky
        sys.path.insert(0, ROOT)
        self.main = importlib.reload(importlib.import_module("main"))

    async def asyncTearDown(self):
        sys.path.remove(ROOT)
        self.tmp.cleanup()

    def write_settings(self, **values):
        with open(os.path.join(self.tmp.name, "settings.json"), "w") as f:
            json.dump(values, f)

    def settings(self) -> dict:
        with open(os.path.join(self.tmp.name, "settings.json")) as f:
            return json.load(f)

    async def start(self, active=False, conns=0):
        m = self.main
        self.set_forced = mock.AsyncMock(return_value=True)
        stack = contextlib.AsyncExitStack()
        stack.enter_context(mock.patch.object(m.installer, "ensure_merged", mock.AsyncMock(return_value=True)))
        stack.enter_context(mock.patch.object(m.installer, "installed", return_value=None))
        stack.enter_context(mock.patch.object(m.service, "start", mock.AsyncMock(return_value=True)))
        stack.enter_context(mock.patch.object(m.service, "is_active", mock.AsyncMock(return_value=active)))
        stack.enter_context(mock.patch.object(m.composite, "set_forced", self.set_forced))
        stack.enter_context(mock.patch.object(m.rustdesk, "get_id", mock.AsyncMock(return_value="123456789")))
        stack.enter_context(mock.patch.object(m.util, "deck_user", return_value=types.SimpleNamespace(pw_uid=1000)))
        self.addAsyncCleanup(stack.aclose)
        plugin = m.Plugin()
        await plugin._main()
        plugin.watcher.cancel()
        plugin.ipc.conn_count = mock.AsyncMock(return_value=conns)
        return plugin

    async def test_turns_off_composition_left_by_a_killed_run(self):
        self.write_settings(composite_forced=True)
        plugin = await self.start()
        await plugin._refresh()
        self.set_forced.assert_awaited_with(False)
        self.assertFalse(self.settings()["composite_forced"])

    async def test_forces_composition_while_connected_and_remembers_it(self):
        plugin = await self.start(active=True, conns=1)
        await plugin._refresh()
        self.set_forced.assert_awaited_with(True)
        self.assertTrue(self.settings()["composite_forced"])
        plugin.ipc.conn_count.return_value = 0
        await plugin._refresh()
        self.set_forced.assert_awaited_with(False)
        self.assertFalse(self.settings()["composite_forced"])

    async def test_pushes_status_only_when_it_changes(self):
        plugin = await self.start(active=True, conns=0)
        await plugin._refresh()
        self.decky.emit.reset_mock()
        await plugin._refresh()
        self.decky.emit.assert_not_awaited()
        plugin.ipc.conn_count.return_value = 2
        status = await plugin._refresh()
        self.decky.emit.assert_awaited_once_with("status", status)
        self.assertEqual(status["connections"], 2)
        self.assertEqual(status["id"], "123456789")

    async def test_unload_does_not_hang_on_a_stuck_composition_call(self):
        self.write_settings(composite_forced=True)
        plugin = await self.start()

        async def stuck(on):
            await asyncio.sleep(60)

        with mock.patch.object(self.main.composite, "set_forced", stuck), \
                mock.patch.object(self.main, "UNLOAD_TIMEOUT", 0.2):
            await asyncio.wait_for(plugin._unload(), 2)
        # Still marked, so the next run turns it off.
        self.assertTrue(self.settings()["composite_forced"])

    async def test_settings_are_refused_while_busy(self):
        plugin = await self.start()
        async with plugin.lock:
            res = await plugin.set_rustdesk_option("enable-audio", "N")
        self.assertEqual(res, {"ok": False, "error": "busy"})


if __name__ == "__main__":
    unittest.main()
