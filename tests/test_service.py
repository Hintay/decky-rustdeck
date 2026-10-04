import os
import tempfile
import unittest
from unittest import mock

from rustdeck import service


class IsActiveTest(unittest.IsolatedAsyncioTestCase):
    async def test_follows_the_unit_cgroup(self):
        with tempfile.TemporaryDirectory() as slice_dir:
            cgroup = os.path.join(slice_dir, "rustdeck-rustdesk.service")
            with mock.patch.object(service, "_SLICE", slice_dir), mock.patch.object(service, "_CGROUP", cgroup), \
                    mock.patch.object(service, "run") as run:
                self.assertFalse(await service.is_active())
                os.mkdir(cgroup)
                self.assertTrue(await service.is_active())
                run.assert_not_called()

    async def test_falls_back_to_systemctl(self):
        result = mock.Mock(ok=True)
        with mock.patch.object(service, "_SLICE", "/nonexistent"), \
                mock.patch.object(service, "run", mock.AsyncMock(return_value=result)) as run:
            self.assertTrue(await service.is_active())
            run.assert_awaited_once()
