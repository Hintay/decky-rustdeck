import asyncio
import json
import os
import tempfile
import unittest
from unittest import mock

from rustdeck import ipc


def frame(data: dict) -> bytes:
    return ipc._encode(json.dumps(data).encode())


class CodecTest(unittest.IsolatedAsyncioTestCase):
    async def test_round_trip_at_header_boundaries(self):
        # Header grows at 2^6, 2^14 and 2^22 bytes of payload.
        for n in (0, 63, 64, 16383, 16384, (1 << 22) - 1, 1 << 22):
            payload = {"t": "X", "c": "a" * n}
            reader = asyncio.StreamReader()
            reader.feed_data(frame(payload))
            self.assertEqual(await ipc._read_frame(reader), payload, n)

    def test_header_length(self):
        self.assertEqual(len(ipc._encode(b"x" * 63)), 63 + 1)
        self.assertEqual(len(ipc._encode(b"x" * 64)), 64 + 2)


class RequestTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.dir.name, "ipc")
        self.client = ipc.Ipc(0)
        self.client.path = self.path

    async def asyncTearDown(self):
        # Since Python 3.12 wait_closed() also waits for open connections.
        for writer in self.writers:
            writer.close()
        self.server.close()
        await self.server.wait_closed()
        self.dir.cleanup()

    async def serve(self, handler):
        self.writers = []

        async def tracked(reader, writer):
            self.writers.append(writer)
            try:
                await handler(reader, writer)
            except (ConnectionError, asyncio.IncompleteReadError):
                pass

        self.server = await asyncio.start_unix_server(tracked, self.path)

    async def test_skips_other_frames_until_the_reply(self):
        async def handler(reader, writer):
            self.assertEqual(await ipc._read_frame(reader), {"t": "VideoConnCount", "c": None})
            writer.write(frame({"t": "ChatMessage", "c": "hi"}) + frame({"t": "VideoConnCount", "c": 2}))
            await writer.drain()

        await self.serve(handler)
        self.assertEqual(await self.client.conn_count(), 2)

    async def test_one_deadline_for_the_whole_exchange(self):
        async def handler(reader, writer):
            await ipc._read_frame(reader)
            # Keeps sending something else, each frame well within any per-frame timeout.
            while True:
                writer.write(frame({"t": "Other", "c": None}))
                await writer.drain()
                await asyncio.sleep(0.05)

        await self.serve(handler)
        with mock.patch.object(ipc, "TIMEOUT", 0.3):
            with self.assertRaises(asyncio.TimeoutError):
                await self.client.conn_count()

    async def test_permanent_password_ack(self):
        async def handler(reader, writer):
            msg = await ipc._read_frame(reader)
            ok = "Y" if len(msg["c"][1]) >= 6 else "N"
            writer.write(frame({"t": "Config", "c": ["permanent-password", ok]}))
            await writer.drain()

        await self.serve(handler)
        self.assertTrue(await self.client.set_permanent_password("secret1"))
        self.assertFalse(await self.client.set_permanent_password("short"))
