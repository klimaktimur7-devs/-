"""Создание session-файла: спросит номер, код из Telegram и пароль 2FA (если есть).

    python login.py acc1
"""
import asyncio
import sys

from telethon import TelegramClient

from config import load_settings


async def main() -> None:
    s = load_settings()
    name = sys.argv[1] if len(sys.argv) > 1 else input("Имя сессии (например acc1): ").strip()
    if not name:
        raise SystemExit("Нужно имя сессии")
    s.sessions_dir.mkdir(parents=True, exist_ok=True)
    path = s.sessions_dir / name.removesuffix(".session")

    client = TelegramClient(str(path), s.api_id, s.api_hash, proxy=s.proxy)
    await client.start()
    me = await client.get_me()
    print(f"Готово: {path}.session — {me.first_name} (@{me.username}, id {me.id})")
    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
