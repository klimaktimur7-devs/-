"""Сценарий одного аккаунта: /start → поиск → спонсоры → проверка подписки."""
import asyncio
import time
from dataclasses import dataclass, field

from telethon import errors

from common import CaptchaDetected, StepError, human_pause, tg_call
from links import Sponsor, process_sponsor


@dataclass
class AccountResult:
    name: str
    status: str = "failed"  # ok | fail | unknown | captcha | flood | failed | unauthorized | dry-run
    check_result: str | None = None  # OK | FAIL | UNKNOWN
    rounds: int = 0
    sponsors: list[Sponsor] = field(default_factory=list)
    failed_sponsors: list[str] = field(default_factory=list)
    reason: str = ""
    last_bot_reply: str = ""
    round_log: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "account": self.name,
            "status": self.status,
            "check_result": self.check_result,
            "rounds": self.rounds,
            "sponsors": [sp.to_dict() for sp in self.sponsors],
            "failed_sponsors": self.failed_sponsors,
            "reason": self.reason,
            "last_bot_reply": self.last_bot_reply,
            "round_log": self.round_log,
        }


# ---------- кнопки ----------

def button_kind(raw) -> tuple[str, str | None]:
    """(вид, url) для raw-кнопки. Работает и со старым, и с новым форматом Telethon."""
    t = getattr(raw, "type", None) or raw
    name = type(t).__name__
    url = getattr(t, "url", None)
    if "Callback" in name:
        return "callback", None
    if "UrlAuth" in name:
        return "url_auth", url
    if "SimpleWebView" in name:
        return "simple_webview", url
    if "WebView" in name:
        return "webview", url
    if "Url" in name:
        return "url", url
    if name in ("ButtonTypeDefault", "KeyboardButton"):
        return "text", None
    return name, url


def iter_buttons(msg):
    for row in msg.buttons or []:
        for btn in row:
            kind, url = button_kind(btn.button)
            yield btn, kind, url


SPONSOR_KINDS = ("url", "url_auth", "webview", "simple_webview")


def is_gate(msg) -> bool:
    """Сообщение со спонсорами: есть хотя бы одна кнопка-ссылка/Mini App."""
    return any(kind in SPONSOR_KINDS for _, kind, _ in iter_buttons(msg))


def extract_sponsors(msg, s) -> list[Sponsor]:
    sponsors = []
    for btn, kind, url in iter_buttons(msg):
        if kind in SPONSOR_KINDS and not s.check_re.search(btn.text or ""):
            sponsors.append(Sponsor(index=len(sponsors) + 1, text=btn.text, url=url, button_type=kind))
    return sponsors


def find_check_button(msg, s):
    for btn, kind, _ in iter_buttons(msg):
        if kind == "callback" and s.check_re.search(btn.text or ""):
            return btn
    return None


def describe_buttons(msg) -> str:
    lines = []
    for r, row in enumerate(msg.buttons or [], 1):
        for c, btn in enumerate(row, 1):
            kind, url = button_kind(btn.button)
            lines.append(f"    [{r}.{c}] {kind:<15} {btn.text!r}" + (f"  → {url}" if url else ""))
    return "\n".join(lines) or "    (кнопок нет)"


# ---------- чат с ботом ----------

class BotChat:
    def __init__(self, client, bot, s, log):
        self.client, self.bot, self.s, self.log = client, bot, s, log

    async def _recent(self):
        return await tg_call(self.s, self.log, lambda: self.client.get_messages(self.bot, limit=10))

    async def snapshot(self) -> dict:
        return {m.id: (m.edit_date, m.raw_text) for m in await self._recent() if not m.out}

    async def wait_changes(self, before: dict, timeout: float | None = None) -> list:
        """Ждёт новые или отредактированные сообщения бота. Возвращает их (старые → новые)."""
        deadline = time.monotonic() + (timeout or self.s.reply_timeout)
        changed = []
        while time.monotonic() < deadline:
            await asyncio.sleep(1)
            changed = [m for m in await self._recent()
                       if not m.out and before.get(m.id) != (m.edit_date, m.raw_text)]
            if changed:
                await asyncio.sleep(2)  # бот может прислать несколько сообщений подряд
                changed = [m for m in await self._recent()
                           if not m.out and before.get(m.id) != (m.edit_date, m.raw_text)]
                break
        return sorted(changed, key=lambda m: m.id)

    async def send_and_wait(self, text: str) -> list:
        before = await self.snapshot()
        await tg_call(self.s, self.log, lambda: self.client.send_message(self.bot, text))
        return await self.wait_changes(before)

    async def find_button(self, pattern, kinds=("text", "callback")):
        for m in await self._recent():
            for btn, kind, _ in iter_buttons(m):
                if kind in kinds and pattern.search(btn.text or ""):
                    return btn
        return None

    async def refetch(self, msg_id: int):
        return await tg_call(self.s, self.log, lambda: self.client.get_messages(self.bot, ids=msg_id))


def texts_of(msgs) -> str:
    return "\n---\n".join(m.raw_text or "" for m in msgs)


def check_captcha(s, text: str) -> None:
    if text and s.captcha_re.search(text):
        raise CaptchaDetected(text)


# ---------- сценарий ----------

async def run_account(client, s, log, result: AccountResult, dry_run: bool) -> None:
    bot = await tg_call(s, log, lambda: client.get_entity(s.bot_username))
    chat = BotChat(client, bot, s, log)

    log.info("Шаг 1: /start")
    replies = await chat.send_and_wait("/start")
    if not replies:
        raise StepError("бот не ответил на /start")
    result.last_bot_reply = texts_of(replies)
    check_captcha(s, result.last_bot_reply)
    gate = next((m for m in reversed(replies) if is_gate(m)), None)

    if gate is None:
        await human_pause(s)
        log.info("Шаг 2: «Поиск собеседника»")
        btn = await chat.find_button(s.search_re)
        before = await chat.snapshot()
        if btn is not None:
            log.info("  жму кнопку %r", btn.text)
            await tg_call(s, log, lambda: btn.click())
        else:
            log.info("  кнопки нет — отправляю текст %r", s.search_fallback_text)
            await tg_call(s, log, lambda: client.send_message(bot, s.search_fallback_text))
        replies = await chat.wait_changes(before)
        if not replies:
            raise StepError("бот не ответил на «Поиск собеседника»")
        result.last_bot_reply = texts_of(replies)
        check_captcha(s, result.last_bot_reply)
        gate = next((m for m in reversed(replies) if is_gate(m)), None)

    if gate is None:
        if s.success_re.search(result.last_bot_reply):
            log.info("Спонсоров нет — бот сразу начал поиск")
            result.status, result.check_result = "ok", "OK"
        else:
            result.status, result.check_result = "unknown", "UNKNOWN"
            result.reason = "не нашёл сообщение со спонсорами"
            for m in replies:
                log.warning("Ответ бота:\n%s\n%s", m.raw_text, describe_buttons(m))
        return

    log.info("Сообщение со спонсорами:\n%s\n%s", gate.raw_text, describe_buttons(gate))
    if dry_run:
        result.status = "dry-run"
        result.sponsors = extract_sponsors(gate, s)
        check = find_check_button(gate, s)
        log.info("DRY-RUN: спонсоров %d, кнопка проверки: %s. Ничего не нажимаю.",
                 len(result.sponsors), repr(check.text) if check else "НЕ НАЙДЕНА (поправь CHECK_BUTTON_REGEX)")
        return

    all_sponsors: dict[str, Sponsor] = {}
    for rnd in range(1, s.max_check_rounds + 1):
        result.rounds = rnd
        sponsors = extract_sponsors(gate, s)
        log.info("Раунд %d: спонсоров %d", rnd, len(sponsors))
        for sp in sponsors:
            prev = all_sponsors.get(sp.key)
            sp.index = prev.index if prev is not None else len(all_sponsors) + 1
            all_sponsors[sp.key] = sp
            await human_pause(s)
            await process_sponsor(client, s, log, sp, bot)
        result.sponsors = list(all_sponsors.values())

        check_btn = find_check_button(gate, s)
        if check_btn is None:
            raise StepError("нет кнопки «Проверить подписку» (поправь CHECK_BUTTON_REGEX)")
        log.info("Жду %s с и жму %r", s.check_delay, check_btn.text)
        await asyncio.sleep(s.check_delay)

        before = await chat.snapshot()
        try:
            answer = await tg_call(s, log, lambda: check_btn.click())
        except (errors.MessageIdInvalidError, errors.DataInvalidError) as e:
            raise StepError(f"кнопка проверки устарела: {e}") from e
        alert = (getattr(answer, "message", None) or "").strip()
        if alert:
            log.info("  всплывающий ответ: %s", alert)
        replies = await chat.wait_changes(before, timeout=6 if alert else None)
        reply_text = texts_of(replies)
        result.last_bot_reply = "\n---\n".join(t for t in (alert, reply_text) if t)
        check_captcha(s, result.last_bot_reply)

        new_gate = next((m for m in reversed(replies) if is_gate(m)), None)
        if new_gate is None and s.fail_re.search(alert) and not s.success_re.search(reply_text):
            new_gate = await chat.refetch(gate.id)
            if new_gate is not None and not is_gate(new_gate):
                new_gate = None

        if new_gate is not None:
            remaining = extract_sponsors(new_gate, s)
            failed = [_label(all_sponsors, sp) for sp in remaining]
            for sp in remaining:
                if sp.key in all_sponsors:
                    all_sponsors[sp.key].ok = False
                    all_sponsors[sp.key].status += " (не засчитано)"
            result.failed_sponsors = failed
            result.round_log.append(f"раунд {rnd} → FAIL (не засчитаны: {', '.join(failed) or '?'})")
            log.info("Проверка подписки: раунд %d → FAIL (не засчитаны: %s)", rnd, ", ".join(failed) or "?")
            result.check_result = "FAIL"
            gate = new_gate
            continue

        if s.success_re.search(result.last_bot_reply) or (replies and not s.fail_re.search(result.last_bot_reply)):
            result.check_result, result.status, result.failed_sponsors = "OK", "ok", []
            result.round_log.append(f"раунд {rnd} → OK")
            log.info("Проверка подписки: раунд %d → OK", rnd)
            return

        result.check_result, result.status = "UNKNOWN", "unknown"
        result.reason = "ответ бота не распознан" if result.last_bot_reply else "бот не ответил на проверку"
        result.round_log.append(f"раунд {rnd} → UNKNOWN")
        log.warning("Проверка подписки: раунд %d → UNKNOWN. Ответ бота:\n%s", rnd, result.last_bot_reply or "(пусто)")
        for m in replies:
            log.warning("%s", describe_buttons(m))
        return

    result.status = "fail"
    result.reason = f"после {s.max_check_rounds} раундов не засчитаны: {', '.join(result.failed_sponsors)}"


def _label(all_sponsors: dict, sp: Sponsor) -> str:
    known = all_sponsors.get(sp.key)
    return f"#{known.index}" if known else f"новый «{sp.text}»"
