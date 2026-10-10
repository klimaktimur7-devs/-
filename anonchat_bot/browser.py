"""Видимое окно браузера для Mini App спонсоров.

Открывает страницу Mini App в Edge/Chrome, чтобы было видно, что происходит,
и ловит, куда страница перекидывает (t.me/... или Telegram.WebApp.openTelegramLink).
Найденную ссылку дальше обрабатывает Telethon.
"""
import asyncio
import re
import time

TG_URL_RE = re.compile(r"^https?://(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog)/", re.IGNORECASE)

# Mini App внутри Telegram общается с клиентом через TelegramWebviewProxy.postEvent.
# Запоминаем эти события, чтобы увидеть openTelegramLink / openLink.
INIT_JS = """
(() => {
  window.__tgEvents = [];
  const proxy = {
    postEvent: (type, data) => {
      let parsed = data;
      try { parsed = data ? JSON.parse(data) : null; } catch (e) {}
      window.__tgEvents.push([type, parsed]);
    },
  };
  try { Object.defineProperty(window, 'TelegramWebviewProxy', { value: proxy, configurable: true }); } catch (e) {}
})();
"""


class MiniAppBrowser:
    def __init__(self, s, log):
        self.s, self.log = s, log
        self._pw = None
        self._browser = None
        self._failed = False

    async def _ensure(self) -> bool:
        if self._browser is not None:
            return True
        if self._failed:
            return False
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            self.log.warning("Playwright не установлен — браузер не открою (запусти START.bat ещё раз)")
            self._failed = True
            return False
        self._pw = await async_playwright().start()
        errors = []
        for channel in ("msedge", "chrome", None):
            try:
                self._browser = await self._pw.chromium.launch(
                    channel=channel, headless=self.s.browser_headless)
                self.log.info("Браузер для Mini App: %s", channel or "chromium")
                return True
            except Exception as e:  # noqa: BLE001 — пробуем следующий браузер
                errors.append(f"{channel or 'chromium'}: {str(e).splitlines()[0]}")
        self.log.warning("Не смог открыть браузер (%s)", "; ".join(errors))
        self._failed = True
        await self._pw.stop()
        self._pw = None
        return False

    async def find_links(self, url: str, label: str) -> list[str] | None:
        """Открывает Mini App и ждёт перекида. None — браузер недоступен."""
        if not await self._ensure():
            return None
        url = _with_webapp_params(url)
        context = await self._browser.new_context(viewport={"width": 430, "height": 860})
        await context.add_init_script(INIT_JS)
        page = await context.new_page()
        found: list[str] = []

        async def catch_tg(route):
            found.append(route.request.url)
            await route.abort()

        await context.route(TG_URL_RE, catch_tg)
        page.on("framenavigated", lambda frame: found.append(frame.url) if frame.url.startswith("tg://") else None)

        self.log.info("  %s: открыл в браузере — смотри окно. Если там надо что-то нажать, нажми.", label)
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        except Exception as e:  # noqa: BLE001 — переход мог прерваться нашим перехватом t.me
            if not found:
                self.log.info("  %s: страница не загрузилась: %s", label, str(e).splitlines()[0])

        deadline = time.monotonic() + self.s.browser_wait
        events: list = []
        while not found and time.monotonic() < deadline:
            await asyncio.sleep(1)
            try:
                events = await page.evaluate("window.__tgEvents || []")
            except Exception:  # noqa: BLE001 — страница как раз перезагружается
                continue
            for name, data in events:
                if not isinstance(data, dict):
                    continue
                if name == "web_app_open_tg_link" and data.get("path_full"):
                    found.append("https://t.me" + data["path_full"])
                elif name == "web_app_open_link" and data.get("url"):
                    found.append(data["url"])

        if found:
            await asyncio.sleep(1.5)  # чтобы было видно, на чём остановилось
        else:
            await self._dump(page, label, events)
        await context.close()
        return found

    async def _dump(self, page, label: str, events: list) -> None:
        """Перекида не было — сохраняем, что было на экране, для разбора."""
        from config import BASE_DIR
        pages = BASE_DIR / "logs" / "pages"
        pages.mkdir(parents=True, exist_ok=True)
        name = re.sub(r"[^A-Za-z0-9]+", "_", label).strip("_") or "page"
        try:
            await page.screenshot(path=str(pages / f"{name}.png"))
            text = (await page.evaluate("document.body ? document.body.innerText : ''"))[:400]
            html = await page.content()
            (pages / f"{name}_browser.html").write_text(
                re.sub(r"tgWebAppData=[^&#\"']*", "tgWebAppData=<скрыто>", html), encoding="utf-8")
        except Exception as e:  # noqa: BLE001 — отладка не должна ронять прогон
            text = f"(не смог снять страницу: {e})"
        self.log.info("  %s: за %s с перекида не было. Адрес: %s. События Telegram: %s. Текст на экране: %r. "
                      "Скриншот: logs/pages/%s.png",
                      label, int(self.s.browser_wait),
                      re.sub(r"tgWebAppData=[^&#]*", "tgWebAppData=<скрыто>", page.url)[:150],
                      [e[0] for e in events] or "нет", text.strip(), name)

    async def close(self) -> None:
        if self._browser is not None:
            await self._browser.close()
            self._browser = None
        if self._pw is not None:
            await self._pw.stop()
            self._pw = None


_instance: MiniAppBrowser | None = None


def get_browser(s, log) -> MiniAppBrowser:
    """Один браузер на весь прогон; лог — текущего аккаунта."""
    global _instance
    if _instance is None:
        _instance = MiniAppBrowser(s, log)
    _instance.log = log
    return _instance


async def close_browser() -> None:
    if _instance is not None:
        await _instance.close()


def _with_webapp_params(url: str) -> str:
    """Telegram-клиент добавляет версию и платформу в адрес Mini App — делаем так же."""
    if "tgWebAppData=" not in url or "tgWebAppVersion=" in url:
        return url
    return url + "&tgWebAppVersion=8.0&tgWebAppPlatform=android"
