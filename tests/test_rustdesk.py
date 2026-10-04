import unittest
from unittest import mock

from rustdeck import rustdesk
from rustdeck.util import Result


class OptionsTest(unittest.IsolatedAsyncioTestCase):
    def test_off_by_default(self):
        self.assertTrue(rustdesk.option_off_by_default("direct-server"))
        self.assertTrue(rustdesk.option_off_by_default("allow-remote-config-modification"))
        self.assertFalse(rustdesk.option_off_by_default("enable-keyboard"))

    async def test_get_options_reads_each_through_the_cli(self):
        async def fake_run(*args, **kwargs):
            name = args[2]
            return Result(0, f"value-of-{name}\n", "") if name != "bad" else Result(1, "", "error")

        with mock.patch.object(rustdesk, "run", fake_run):
            got = await rustdesk.get_options(["a", "bad", "b"])
        self.assertEqual(got, {"a": "value-of-a", "bad": "", "b": "value-of-b"})

    def test_approve_mode_is_not_editable(self):
        # Click-to-accept needs a window gamescope never shows.
        self.assertNotIn("approve-mode", rustdesk.EDITABLE_OPTIONS)
