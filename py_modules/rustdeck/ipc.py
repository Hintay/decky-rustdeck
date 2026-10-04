# Async client for the per-user `rustdesk --server` IPC socket.
#
# Frames use hbb_common's BytesCodec: a 1-4 byte little-endian header holding
# `len << 2 | (header_len - 1)`, wrapping serde_json `Data` values ({"t": tag, "c": content}).
import asyncio
import json

TIMEOUT = 3.0


def _encode(payload: bytes) -> bytes:
    n = len(payload)
    for head_len in range(1, 5):
        if n < 1 << (8 * head_len - 2):
            return ((n << 2) | (head_len - 1)).to_bytes(head_len, "little") + payload
    raise ValueError("ipc frame too large")


async def _read_frame(reader: asyncio.StreamReader) -> dict:
    first = await reader.readexactly(1)
    head = first + await reader.readexactly(first[0] & 0x3)
    n = int.from_bytes(head, "little") >> 2
    return json.loads(await reader.readexactly(n))


class Ipc:
    def __init__(self, uid: int):
        self.path = f"/tmp/RustDesk-{uid}/ipc"

    async def _request(self, data: dict, reply_tag: str | None):
        reader, writer = await asyncio.wait_for(asyncio.open_unix_connection(self.path), TIMEOUT)
        try:
            writer.write(_encode(json.dumps(data).encode()))
            await writer.drain()
            if reply_tag is None:
                return None
            while True:
                msg = await asyncio.wait_for(_read_frame(reader), TIMEOUT)
                if msg.get("t") == reply_tag:
                    return msg.get("c")
        finally:
            writer.close()

    async def get_config(self, name: str) -> str | None:
        content = await self._request({"t": "Config", "c": [name, None]}, "Config")
        return content[1] if content else None

    async def set_config(self, name: str, value: str) -> None:
        await self._request({"t": "Config", "c": [name, value]}, None)

    async def conn_count(self) -> int:
        return int(await self._request({"t": "VideoConnCount", "c": None}, "VideoConnCount") or 0)

    async def get_options(self) -> dict[str, str]:
        # Writing `Options` replaces the whole map, so single options go through the CLI instead.
        return await self._request({"t": "Options", "c": None}, "Options") or {}

    async def set_permanent_password(self, password: str) -> bool:
        """The server acknowledges this write with "Y" (accepted) or "N" (rejected by policy)."""
        content = await self._request({"t": "Config", "c": ["permanent-password", password]}, "Config")
        return bool(content) and content[1] == "Y"
