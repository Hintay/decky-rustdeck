import asyncio
import os
import tempfile
import unittest

from rustdeck import util


class RunTest(unittest.IsolatedAsyncioTestCase):
    async def test_output_and_exit_code(self):
        res = await util.run("sh", "-c", "echo out; echo err >&2; exit 3")
        self.assertEqual((res.code, res.out.strip(), res.err.strip()), (3, "out", "err"))

    async def test_timeout_kills_the_program(self):
        res = await util.run("sleep", "30", timeout=0.2)
        self.assertEqual(res.err, "timeout")

    async def test_cancelling_kills_the_program(self):
        with tempfile.TemporaryDirectory() as tmp:
            pidfile = os.path.join(tmp, "pid")
            task = asyncio.create_task(util.run("sh", "-c", f"echo $$ > {pidfile}; exec sleep 30"))
            for _ in range(50):
                if os.path.exists(pidfile) and open(pidfile).read().strip():
                    break
                await asyncio.sleep(0.05)
            pid = int(open(pidfile).read())
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
            await asyncio.sleep(0.2)
            with self.assertRaises(ProcessLookupError):
                os.kill(pid, 0)

    def test_clean_env_restores_the_loader_library_path(self):
        os.environ["LD_LIBRARY_PATH"] = "/bundle"
        os.environ["LD_LIBRARY_PATH_ORIG"] = "/system"
        try:
            self.assertEqual(util.clean_env()["LD_LIBRARY_PATH"], "/system")
            del os.environ["LD_LIBRARY_PATH_ORIG"]
            self.assertNotIn("LD_LIBRARY_PATH", util.clean_env())
        finally:
            os.environ.pop("LD_LIBRARY_PATH", None)
            os.environ.pop("LD_LIBRARY_PATH_ORIG", None)
