"""Точка входа: проходит обязательную подписку в боте для каждого аккаунта по очереди.

    python main.py --dry-run --session acc1   # только показать спонсоров
    python main.py                            # все сессии из SESSIONS_DIR
"""
import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime

from telethon import TelegramClient, errors

from common import CaptchaDetected, FloodTooLong, StepError
from config import BASE_DIR, load_settings
from flow import AccountResult, run_account

RETRIES = 2
STATUS_ICON = {"ok": "✅", "dry-run": "👀"}


def setup_logging(stamp: str) -> logging.Logger:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except AttributeError:
            pass
    logs_dir = BASE_DIR / "logs"
    logs_dir.mkdir(exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)-7s %(message)s", "%H:%M:%S")
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    for handler in (logging.StreamHandler(sys.stdout),
                    logging.FileHandler(logs_dir / f"run_{stamp}.log", encoding="utf-8")):
        handler.setFormatter(fmt)
        root.addHandler(handler)
    logging.getLogger("telethon").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    return logging.getLogger("anonchat")


class AccountLog(logging.LoggerAdapter):
    def process(self, msg, kwargs):
        return f"[{self.extra['account']}] {msg}", kwargs


def list_sessions(s, only: str | None) -> list[str]:
    if only:
        return [only.removesuffix(".session")]
    if s.sessions:
        return s.sessions
    return sorted(p.stem for p in s.sessions_dir.glob("*.session"))


async def run_one(s, name: str, dry_run: bool) -> AccountResult:
    log = AccountLog(logging.getLogger("anonchat"), {"account": name})
    result = AccountResult(name)
    session_path = s.sessions_dir / name
    if not session_path.parent.joinpath(name + ".session").exists():
        result.status, result.reason = "unauthorized", "нет файла сессии"
        log.error("Нет файла %s.session", session_path)
        return result

    for attempt in range(1, RETRIES + 2):
        client = TelegramClient(str(session_path), s.api_id, s.api_hash, proxy=s.proxy)
        try:
            await client.connect()
            if not await client.is_user_authorized():
                result.status, result.reason = "unauthorized", "сессия не авторизована (запусти login.py)"
                log.error(result.reason)
                return result
            me = await client.get_me()
            log.info("Вошёл как %s (id %s)", f"@{me.username}" if me.username else me.first_name, me.id)
            result.reason = ""
            await run_account(client, s, log, result, dry_run)
            return result
        except CaptchaDetected as e:
            result.status, result.reason, result.last_bot_reply = "captcha", "бот показал капчу/челлендж", e.text
            log.warning("Капча/челлендж — пропускаю аккаунт. Текст бота:\n%s", e.text)
            return result
        except FloodTooLong as e:
            result.status, result.reason = "flood", f"FloodWait {e.seconds} с"
            log.warning("Слишком долгий FloodWait (%s с) — пропускаю аккаунт", e.seconds)
            return result
        except (errors.AuthKeyUnregisteredError, errors.UserDeactivatedError,
                errors.UserDeactivatedBanError) as e:
            result.status, result.reason = "unauthorized", f"{type(e).__name__}"
            log.error("Сессия недействительна: %s", e)
            return result
        except (StepError, ConnectionError, OSError, asyncio.TimeoutError, errors.RPCError) as e:
            result.status, result.reason = "failed", f"{type(e).__name__}: {e}"
            log.warning("Попытка %d/%d не удалась: %s", attempt, RETRIES + 1, result.reason)
        finally:
            await client.disconnect()
        if attempt <= RETRIES:
            await asyncio.sleep(5)
    return result


def print_account_block(r: AccountResult, log: logging.Logger) -> None:
    lines = [f"[{r.name}] Спонсоры:"]
    for sp in r.sponsors:
        mark = "" if r.status == "dry-run" else ("✅" if sp.ok else "❌")
        target = (sp.target or sp.url or sp.text)[:40]
        status = sp.button_type if r.status == "dry-run" else sp.status
        lines.append(f"  {sp.index}. {target:<40} {sp.kind:<14} {status:<28} {mark}")
    if not r.sponsors:
        lines.append("  (нет)")
    for line in r.round_log:
        lines.append(f"[{r.name}] Проверка подписки: {line}")
    if r.status == "ok":
        lines.append(f"[{r.name}] ИТОГ: ✅ ПРОЙДЕНО")
    elif r.status == "dry-run":
        lines.append(f"[{r.name}] ИТОГ: 👀 DRY-RUN, ничего не нажато")
    else:
        lines.append(f"[{r.name}] ИТОГ: ❌ НЕ ПРОЙДЕНО ({r.status}) — причина: {r.reason or '—'}")
        if r.last_bot_reply:
            lines.append(f"[{r.name}] Последний ответ бота:\n{r.last_bot_reply}")
    log.info("\n" + "\n".join(lines))


def print_summary(results: list[AccountResult], log: logging.Logger) -> None:
    rows = [("аккаунт", "статус", "спонсоры", "причина")]
    for r in results:
        done = sum(sp.ok for sp in r.sponsors)
        rows.append((r.name, f"{STATUS_ICON.get(r.status, '❌')} {r.status}",
                     f"{done}/{len(r.sponsors)}", r.reason or ""))
    widths = [max(len(row[i]) for row in rows) for i in range(3)]
    out = ["", "=" * 60, "СВОДКА"]
    for row in rows:
        out.append("  ".join(cell.ljust(widths[i]) if i < 3 else cell for i, cell in enumerate(row)))
    ok = sum(r.status == "ok" for r in results)
    out.append(f"Пройдено: {ok}/{len(results)}")
    log.info("\n".join(out))


async def main() -> None:
    parser = argparse.ArgumentParser(description="Прохождение обязательной подписки в боте")
    parser.add_argument("--dry-run", action="store_true",
                        help="дойти до списка спонсоров, показать кнопки и ничего не нажимать")
    parser.add_argument("--session", help="запустить только одну сессию (имя без .session)")
    args = parser.parse_args()

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log = setup_logging(stamp)
    s = load_settings()
    names = list_sessions(s, args.session)
    if not names:
        log.error("Нет сессий в %s. Создай их через: python login.py", s.sessions_dir)
        return
    log.info("Аккаунтов: %d (%s)%s", len(names), ", ".join(names), " — DRY-RUN" if args.dry_run else "")

    results = []
    for i, name in enumerate(names):
        if i:
            log.info("Пауза %s с перед следующим аккаунтом", s.account_pause)
            await asyncio.sleep(s.account_pause)
        try:
            r = await run_one(s, name, args.dry_run)
        except Exception as e:  # noqa: BLE001 — один аккаунт не роняет прогон
            logging.getLogger("anonchat").exception("[%s] Непредвиденная ошибка", name)
            r = AccountResult(name, status="failed", reason=f"{type(e).__name__}: {e}")
        results.append(r)
        print_account_block(r, log)

    print_summary(results, log)
    summary_path = BASE_DIR / "logs" / f"summary_{stamp}.json"
    summary_path.write_text(json.dumps([r.to_dict() for r in results], ensure_ascii=False, indent=2),
                            encoding="utf-8")
    log.info("Отчёт: %s", summary_path)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Остановлено")
