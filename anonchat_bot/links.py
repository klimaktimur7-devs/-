"""Разбор и обработка ссылок спонсоров: боты, каналы, инвайты, Mini App."""
import random
import re
from dataclasses import dataclass, field
from urllib.parse import parse_qs, urlparse

import httpx
from telethon import errors, functions, types, utils

from common import FloodTooLong, human_pause, tg_call

TG_HOSTS = {"t.me", "telegram.me", "telegram.dog", "www.t.me"}
TG_LINK_RE = re.compile(
    r"""(?:https?://(?:t\.me|telegram\.me|telegram\.dog)/[^\s"'<>\\)]+|tg://(?:resolve|join)\?[^\s"'<>\\)]+)""",
    re.IGNORECASE,
)
SKIP_LINK_RE = re.compile(r"t\.me/(?:share|iv|addstickers|addemoji|setlanguage|proxy|socks)\b", re.IGNORECASE)
WEBVIEW_PLATFORM = "android"
MOBILE_UA = (
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 Telegram-Android/11.0"
)


@dataclass
class Link:
    kind: str  # bot_or_channel | invite | miniapp | external | unknown
    username: str | None = None
    param: str | None = None  # start=
    startapp: str | None = None
    app: str | None = None  # short name Mini App
    invite_hash: str | None = None
    raw: str = ""


@dataclass
class Sponsor:
    index: int
    text: str
    url: str | None
    button_type: str  # url | webview | simple_webview | url_auth
    kind: str = "?"  # бот / канал / заявка / mini app / ...
    target: str = ""
    status: str = "не обработан"
    ok: bool = False
    details: list[str] = field(default_factory=list)

    @property
    def key(self) -> str:
        return self.url or self.text

    def to_dict(self) -> dict:
        return {
            "index": self.index,
            "text": self.text,
            "url": self.url,
            "button_type": self.button_type,
            "kind": self.kind,
            "target": self.target,
            "status": self.status,
            "ok": self.ok,
            "details": self.details,
        }


def parse_link(url: str) -> Link:
    url = url.strip()
    if re.match(r"(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog)/", url, re.IGNORECASE):
        url = "https://" + url
    u = urlparse(url)
    q = {k: v[0] for k, v in parse_qs(u.query).items()}

    if u.scheme == "tg":
        if u.netloc == "join" and q.get("invite"):
            return Link("invite", invite_hash=q["invite"], raw=url)
        if u.netloc == "resolve" and q.get("domain"):
            if q.get("appname"):
                return Link("miniapp", username=q["domain"], app=q["appname"], startapp=q.get("startapp"), raw=url)
            if "startapp" in q:
                return Link("miniapp", username=q["domain"], startapp=q.get("startapp"), raw=url)
            return Link("bot_or_channel", username=q["domain"], param=q.get("start"), raw=url)
        return Link("unknown", raw=url)

    if u.scheme in ("http", "https") and (u.hostname or "").lower() in TG_HOSTS:
        parts = [p for p in u.path.split("/") if p]
        if not parts:
            return Link("unknown", raw=url)
        if parts[0].startswith("+"):
            return Link("invite", invite_hash=parts[0][1:], raw=url)
        if parts[0] == "joinchat" and len(parts) > 1:
            return Link("invite", invite_hash=parts[1], raw=url)
        if parts[0] == "s" and len(parts) > 1:
            parts = parts[1:]
        name = parts[0].lstrip("@")
        if len(parts) > 1 and not parts[1].isdigit():
            return Link("miniapp", username=name, app=parts[1], startapp=q.get("startapp"), raw=url)
        if "startapp" in q:
            return Link("miniapp", username=name, startapp=q.get("startapp"), raw=url)
        return Link("bot_or_channel", username=name, param=q.get("start"), raw=url)

    if u.scheme in ("http", "https"):
        return Link("external", raw=url)
    return Link("unknown", raw=url)


async def process_sponsor(client, s, log, sponsor: Sponsor, gate_bot) -> None:
    """Обрабатывает одного спонсора и заполняет sponsor.status / ok."""
    try:
        if sponsor.button_type in ("webview", "simple_webview"):
            sponsor.kind = "mini app"
            sponsor.target = sponsor.url or ""
            webapp_url = await _request_button_webview(client, s, log, sponsor, gate_bot)
            await _follow_webapp(client, s, log, sponsor, webapp_url)
        elif not sponsor.url:
            _fail(sponsor, "у кнопки нет ссылки")
        else:
            await _process_link(client, s, log, sponsor, parse_link(sponsor.url), depth=0)
    except FloodTooLong:
        raise
    except Exception as e:  # noqa: BLE001 — один спонсор не должен ронять аккаунт
        _fail(sponsor, f"ошибка: {type(e).__name__}: {e}")
    log.info("  спонсор #%d [%s] %s → %s %s", sponsor.index, sponsor.kind, sponsor.target,
             sponsor.status, "✅" if sponsor.ok else "❌")


def _ok(sponsor: Sponsor, status: str) -> None:
    sponsor.ok, sponsor.status = True, status


def _fail(sponsor: Sponsor, status: str) -> None:
    sponsor.ok, sponsor.status = False, status


async def _process_link(client, s, log, sponsor: Sponsor, link: Link, depth: int) -> None:
    if link.kind == "invite":
        sponsor.kind = "канал (инвайт)"
        sponsor.target = link.raw
        await _join_invite(client, s, log, sponsor, link.invite_hash)
    elif link.kind == "bot_or_channel":
        await _bot_or_channel(client, s, log, sponsor, link)
    elif link.kind == "miniapp":
        sponsor.kind = "mini app"
        sponsor.target = link.raw
        if depth > 0:
            _fail(sponsor, "Mini App ведёт на другой Mini App — не обрабатываю")
            return
        webapp_url = await _request_link_webview(client, s, log, link)
        await _follow_webapp(client, s, log, sponsor, webapp_url)
    elif link.kind == "external":
        sponsor.kind = "внешняя ссылка"
        sponsor.target = link.raw
        if depth > 0:
            _fail(sponsor, "внешняя ссылка ведёт на другую внешнюю — не обрабатываю")
            return
        await _follow_webapp(client, s, log, sponsor, link.raw)
    else:
        sponsor.kind = "?"
        sponsor.target = link.raw
        _fail(sponsor, "тип ссылки не распознан")


async def _bot_or_channel(client, s, log, sponsor: Sponsor, link: Link) -> None:
    entity = await tg_call(s, log, lambda: client.get_entity(link.username))
    sponsor.target = "@" + link.username

    if isinstance(entity, types.User) and entity.bot:
        sponsor.kind = "бот"
        if link.param:
            await tg_call(s, log, lambda: client(functions.messages.StartBotRequest(
                bot=entity, peer=entity, start_param=link.param, random_id=random.getrandbits(63))))
        else:
            await tg_call(s, log, lambda: client.send_message(entity, "/start"))
        _ok(sponsor, "старт нажат")
    elif isinstance(entity, types.Channel):
        sponsor.kind = "канал" if entity.broadcast else "группа"
        if not entity.left:
            _ok(sponsor, "уже подписан")
            return
        try:
            await tg_call(s, log, lambda: client(functions.channels.JoinChannelRequest(entity)))
            _ok(sponsor, "подписан")
        except errors.UserAlreadyParticipantError:
            _ok(sponsor, "уже подписан")
        except errors.InviteRequestSentError:
            _ok(sponsor, "заявка отправлена")
    else:
        sponsor.kind = "пользователь"
        _fail(sponsor, "ссылка ведёт на обычного пользователя")


async def _join_invite(client, s, log, sponsor: Sponsor, invite_hash: str) -> None:
    try:
        await tg_call(s, log, lambda: client(functions.messages.ImportChatInviteRequest(invite_hash)))
        _ok(sponsor, "подписан")
    except errors.UserAlreadyParticipantError:
        _ok(sponsor, "уже подписан")
    except errors.InviteRequestSentError:
        _ok(sponsor, "заявка отправлена")
    except (errors.InviteHashExpiredError, errors.InviteHashInvalidError):
        _fail(sponsor, "инвайт недействителен")


async def _request_button_webview(client, s, log, sponsor: Sponsor, gate_bot) -> str:
    """URL Mini App из web_app-кнопки в сообщении бота."""
    if sponsor.button_type == "simple_webview":
        req = functions.messages.RequestSimpleWebViewRequest(
            bot=gate_bot, platform=WEBVIEW_PLATFORM, url=sponsor.url)
    else:
        req = functions.messages.RequestWebViewRequest(
            peer=gate_bot, bot=gate_bot, platform=WEBVIEW_PLATFORM, url=sponsor.url)
    res = await tg_call(s, log, lambda: client(req))
    return res.url


async def _request_link_webview(client, s, log, link: Link) -> str:
    """URL Mini App по ссылке t.me/<bot>/<app> или t.me/<bot>?startapp=."""
    bot_peer = await tg_call(s, log, lambda: client.get_input_entity(link.username))
    if link.app:
        app = types.InputBotAppShortName(bot_id=utils.get_input_user(bot_peer), short_name=link.app)
        req = functions.messages.RequestAppWebViewRequest(
            peer=bot_peer, app=app, platform=WEBVIEW_PLATFORM, write_allowed=True,
            start_param=link.startapp)
    else:
        req = functions.messages.RequestMainWebViewRequest(
            peer=bot_peer, bot=bot_peer, platform=WEBVIEW_PLATFORM, start_param=link.startapp)
    res = await tg_call(s, log, lambda: client(req))
    return res.url


async def _follow_webapp(client, s, log, sponsor: Sponsor, webapp_url: str) -> None:
    """Открывает страницу без браузера и ищет в ней ссылку на канал/бота."""
    log.info("  спонсор #%d: открываю %s", sponsor.index, _short(webapp_url))
    found: list[str] = []
    final_url = webapp_url
    snippet = ""
    try:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=15, proxy=s.proxy_url,
            headers={"User-Agent": MOBILE_UA},
        ) as http:
            resp = await http.get(webapp_url)
            final_url = str(resp.url)
            for r in resp.history:
                loc = r.headers.get("location", "")
                if TG_LINK_RE.search(loc):
                    found.append(TG_LINK_RE.search(loc).group(0))
            found.extend(TG_LINK_RE.findall(final_url))
            body = resp.text.replace("\\/", "/").replace("\\u002F", "/").replace("\\u002f", "/")
            snippet = body[:3000]
            found.extend(TG_LINK_RE.findall(body))
    except httpx.HTTPError as e:
        sponsor.details.append(f"HTTP ошибка: {e}")

    own = parse_link(sponsor.url or "")
    candidates = []
    for raw in found:
        raw = raw.replace("\\/", "/").rstrip(".,;")
        if SKIP_LINK_RE.search(raw) or raw in candidates:
            continue
        link = parse_link(raw)
        if link.kind == "miniapp" or (own.username and link.username == own.username):
            continue
        candidates.append(raw)

    sponsor.details.append(f"webapp: {webapp_url}")
    sponsor.details.append(f"финальный адрес: {final_url}")
    if not candidates:
        sponsor.details.append(f"HTML (начало): {snippet[:1500]}")
        log.warning("  спонсор #%d: в Mini App не нашёл ссылку на канал/бота. Финальный адрес: %s\n%s",
                    sponsor.index, final_url, snippet[:1500])
        _fail(sponsor, "ссылка не найдена")
        return

    target = candidates[0]
    sponsor.details.append(f"найдена ссылка: {target}")
    log.info("  спонсор #%d: Mini App ведёт на %s", sponsor.index, target)
    await human_pause(s)
    kind_before = sponsor.kind
    await _process_link(client, s, log, sponsor, parse_link(target), depth=1)
    sponsor.kind = f"{kind_before} → {sponsor.kind}"


def _short(url: str, n: int = 120) -> str:
    return url if len(url) <= n else url[:n] + "…"
