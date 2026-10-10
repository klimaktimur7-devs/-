"""Общие помощники: паузы, FloodWait, исключения."""
import asyncio
import random

from telethon import errors


class StepError(Exception):
    """Шаг не удался (нет ответа, нет кнопки). Аккаунт можно повторить."""


class FloodTooLong(Exception):
    def __init__(self, seconds: int):
        super().__init__(f"FloodWait {seconds} с")
        self.seconds = seconds


class CaptchaDetected(Exception):
    def __init__(self, text: str):
        super().__init__("бот показал капчу/челлендж")
        self.text = text


async def human_pause(s) -> None:
    await asyncio.sleep(random.uniform(s.action_delay_min, s.action_delay_max))


async def tg_call(s, log, make_coro):
    """Выполняет запрос к Telegram. Короткий FloodWait пережидает, длинный — FloodTooLong.

    make_coro — функция без аргументов, создающая корутину (корутину нельзя await-ить дважды).
    """
    for attempt in range(3):
        try:
            return await make_coro()
        except errors.FloodWaitError as e:
            if e.seconds > s.flood_max_wait or attempt == 2:
                raise FloodTooLong(e.seconds) from e
            log.warning("FloodWait %s с — жду", e.seconds)
            await asyncio.sleep(e.seconds + 1)
