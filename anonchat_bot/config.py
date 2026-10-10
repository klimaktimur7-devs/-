"""Настройки из .env."""
import os
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _str(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _num(name: str, default: float) -> float:
    raw = _str(name)
    return float(raw) if raw else default


def _re(name: str, default: str) -> re.Pattern:
    return re.compile(_str(name) or default, re.IGNORECASE)


def _proxy(raw: str):
    """socks5://user:pass@host:port -> dict для Telethon (нужен python-socks)."""
    if not raw:
        return None
    u = urlparse(raw)
    if not u.hostname or not u.port:
        raise ValueError(f"Неверный PROXY: {raw}")
    return {
        "proxy_type": u.scheme or "socks5",
        "addr": u.hostname,
        "port": u.port,
        "username": u.username,
        "password": u.password,
        "rdns": True,
    }


@dataclass
class Settings:
    api_id: int
    api_hash: str
    sessions_dir: Path
    sessions: list[str]
    bot_username: str
    search_re: re.Pattern
    search_fallback_text: str
    check_re: re.Pattern
    success_re: re.Pattern
    fail_re: re.Pattern
    captcha_re: re.Pattern
    reply_timeout: float
    check_delay: float
    max_check_rounds: int
    action_delay_min: float
    action_delay_max: float
    account_pause: float
    flood_max_wait: int
    proxy: dict | None
    proxy_url: str | None


def load_settings() -> Settings:
    api_id = _str("API_ID")
    api_hash = _str("API_HASH")
    if not api_id or not api_hash:
        raise SystemExit("Заполни API_ID и API_HASH в .env (см. .env.example)")

    sessions_dir = Path(_str("SESSIONS_DIR", "sessions"))
    if not sessions_dir.is_absolute():
        sessions_dir = BASE_DIR / sessions_dir

    proxy_url = _str("PROXY") or None
    return Settings(
        api_id=int(api_id),
        api_hash=api_hash,
        sessions_dir=sessions_dir,
        sessions=[s.strip().removesuffix(".session") for s in _str("SESSIONS").split(",") if s.strip()],
        bot_username=_str("BOT_USERNAME", "N1anonchat_bot").lstrip("@"),
        search_re=_re("SEARCH_BUTTON_REGEX", r"поиск|найти собеседника|искать"),
        search_fallback_text=_str("SEARCH_FALLBACK_TEXT", "Поиск собеседника"),
        check_re=_re("CHECK_BUTTON_REGEX", r"провер|подписал|продолж|готово|✅"),
        success_re=_re("SUCCESS_REGEX", r"ищем собеседника|поиск начат|ид[её]т поиск|собеседник найден"),
        fail_re=_re("FAIL_REGEX", r"не подписал|подпишитесь|не выполнил|не все|не на все"),
        captcha_re=_re("CAPTCHA_REGEX", r"капч|captcha|не робот|докажите|решите пример"),
        reply_timeout=_num("REPLY_TIMEOUT", 20),
        check_delay=_num("CHECK_DELAY", 5),
        max_check_rounds=int(_num("MAX_CHECK_ROUNDS", 3)),
        action_delay_min=_num("ACTION_DELAY_MIN", 2),
        action_delay_max=_num("ACTION_DELAY_MAX", 5),
        account_pause=_num("ACCOUNT_PAUSE", 30),
        flood_max_wait=int(_num("FLOOD_MAX_WAIT", 120)),
        proxy=_proxy(proxy_url or ""),
        proxy_url=proxy_url,
    )
