# gift-resolver

Resolves a Telegram NFT gift by its `t.me/nft/<slug>` slug into JSON, using
`payments.getUniqueStarGift` — an MTProto method available only to a logged-in
user session (not a bot token).

## One-time setup (already done on the production VPS as of 2026-09-24)

1. `python3 -m venv venv && ./venv/bin/pip install -r requirements.txt`
2. Create `.env` next to this file:
   ```
   TG_API_ID=...
   TG_API_HASH=...
   GIFT_ASSETS_DIR=/opt/telegram-casino/gift-assets
   ```
3. Log in once (interactive — needs the phone's login code, and the 2FA
   password if one is set): run a Telethon `send_code_request` /
   `sign_in` flow against the `gift_resolver` session name in this directory.
   The resulting `gift_resolver.session` file is the credential — never
   commit it, back it up somewhere safe instead.

## Usage

```
./venv/bin/python resolve_gift.py <slug>
```
Prints JSON to stdout on success (exit 0), or `{"error": ...}` to stderr
(exit 1) on failure. See `backend/src/gifts/gift-resolver.client.ts` for the
exact contract this output is parsed against.
