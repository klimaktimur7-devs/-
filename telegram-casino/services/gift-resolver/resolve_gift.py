import asyncio
import json
import os
import sys

from telethon import TelegramClient
from telethon.tl import functions
from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(SCRIPT_DIR, ".env"))

api_id = int(os.environ["TG_API_ID"])
api_hash = os.environ["TG_API_HASH"]
assets_dir = os.environ.get("GIFT_ASSETS_DIR", os.path.join(SCRIPT_DIR, "gift-assets"))
session_path = os.path.join(SCRIPT_DIR, "gift_resolver")


def fail(error_code: str, message: str = "") -> None:
    payload = {"error": error_code}
    if message:
        payload["message"] = message
    print(json.dumps(payload), file=sys.stderr)
    sys.exit(1)


def attr_by_type(attributes, type_name):
    for attr in attributes:
        if type(attr).__name__ == type_name:
            return attr
    return None


def is_slug_not_found_error(error: Exception) -> bool:
    # Telegram's actual error for a nonexistent/invalid slug, observed live:
    # "RPCError 400: STARGIFT_SLUG_INVALID (caused by GetUniqueStarGiftRequest)".
    # Any other failure (session logged out, flood-wait, network error) must
    # NOT be reported as "not found" — the caller maps gift_not_found to a
    # user-facing 400 "link didn't resolve", which would be misleading for a
    # problem that has nothing to do with the link itself.
    return "SLUG_INVALID" in str(error)


async def main(slug: str) -> None:
    client = TelegramClient(session_path, api_id, api_hash)
    try:
        await client.connect()

        if not await client.is_user_authorized():
            fail("resolver_error", "session is not authorized (logged out or session expired)")
            return

        try:
            result = await client(functions.payments.GetUniqueStarGiftRequest(slug=slug))
        except Exception as error:  # noqa: BLE001 - narrowed to slug-not-found below; anything else is a resolver_error
            if is_slug_not_found_error(error):
                fail("gift_not_found", str(error))
            else:
                fail("resolver_error", str(error))
            return

        gift = result.gift
        model_attr = attr_by_type(gift.attributes, "StarGiftAttributeModel")
        pattern_attr = attr_by_type(gift.attributes, "StarGiftAttributePattern")
        backdrop_attr = attr_by_type(gift.attributes, "StarGiftAttributeBackdrop")

        if not (model_attr and pattern_attr and backdrop_attr):
            fail("gift_not_found", "missing expected attributes")
            return

        image_url = None
        try:
            os.makedirs(assets_dir, exist_ok=True)
            dest_path = os.path.join(assets_dir, f"{slug}.webp")
            await client.download_media(model_attr.document, file=dest_path, thumb=0)
            image_url = f"/gift-assets/{slug}.webp"
        except Exception:  # noqa: BLE001 - image download failing must not block the rest of the data
            image_url = None

        print(
            json.dumps(
                {
                    "name": gift.title,
                    "editionNumber": gift.num,
                    "model": model_attr.name,
                    "symbol": pattern_attr.name,
                    "backdropName": backdrop_attr.name,
                    "backdropColor": "#%06x" % backdrop_attr.center_color,
                    "imageUrl": image_url,
                    "telegramSlug": gift.slug,
                }
            )
        )
    finally:
        await client.disconnect()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        fail("resolver_error", "usage: resolve_gift.py <slug>")
    asyncio.run(main(sys.argv[1]))
