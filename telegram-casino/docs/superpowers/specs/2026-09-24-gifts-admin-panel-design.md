# Админка Gifts — дизайн

Дата: 2026-09-24
Подпроект: 9 (Админ-панель, в части Gifts) + продолжение подпроекта 4 (Магазин NFT Gifts) из `2026-09-21-core-platform-design.md`.

## Контекст

`MarketScreen` (Магазин → Gifts) уже реализован на фронте и визуально сверен с
референсом (myballs.io): карточки, фильтры Тип/Скин/Фон, детальная модалка.
Компонент принимает список подарков через проп `gifts` и сейчас получает
пустой массив — реального источника данных нет, бэкенда под Gifts не
существовало вовсе.

Владелец проекта (Telegram ID `6742434708`) хочет добавлять подарки сам,
внутри мини-аппа, вставляя публичную ссылку вида `t.me/nft/<slug>` на
реальный Telegram NFT-подарок — без ручного заполнения полей, кроме цены.

## Технический риск и его снятие (уже проверено вживую)

Открытый вопрос был: существует ли способ получить Model/Backdrop/Symbol/
картинку подарка по одной только публичной ссылке. Ответ — да, но не через
Bot API, а через MTProto-метод `payments.getUniqueStarGift(slug)`: публичный,
не требует владения подарком, доступен только из-под залогиненного
пользовательского Telegram-аккаунта (Telethon), а не бота.

Проверено вживую на сервере (`45.86.63.105`) на реальном подарке
`t.me/nft/ViceCream-33564`:

```
title: Vice Cream
model: Vanilla
symbol (pattern): Pickaxe
backdrop: Camo Green (center_color=7705677 → зелёный, сходится)
```

и скачивание статичного превью модели (128×128 jpg, официальный рендер
Telegram) — тоже подтверждено, файл реально открылся и это картинка подарка,
а не мусор.

Инфраструктурный шаг уже выполнен: на сервере создана Python-сессия Telethon
под отдельным Telegram-аккаунтом владельца (`/opt/telegram-casino/services/
gift-resolver/gift_resolver.session`), `api_id`/`api_hash` и
`ADMIN_TELEGRAM_ID` лежат в `.env` там же (не в git). Формализация этого кода
в постоянный скрипт — часть плана реализации.

## Архитектура

Три новых куска:

1. **`services/gift-resolver/`** (Python, Telethon). Бэкенд по запросу
   спавнит `python resolve_gift.py <slug>` как дочерний процесс (без
   постоянно висящего сервиса — реальная нагрузка низкая, один админ,
   изредка). Скрипт: резолвит slug через `payments.getUniqueStarGift`,
   скачивает статичный thumb модели в `/opt/telegram-casino/gift-assets/
   <slug>.jpg`, печатает в stdout JSON:
   ```json
   {
     "name": "Vice Cream",
     "editionNumber": 33564,
     "model": "Vanilla",
     "symbol": "Pickaxe",
     "backdropName": "Camo Green",
     "backdropColor": "#75944d",
     "imageUrl": "/gift-assets/ViceCream-33564.jpg",
     "telegramSlug": "ViceCream-33564"
   }
   ```
   Ошибка (невалидный slug, сессия разлогинилась, таймаут) → ненулевой exit
   code + сообщение об ошибке в stderr.

2. **Backend: новый `GiftsModule`** (NestJS/TypeORM, структура как у
   `ledger`/`deposits`): `GiftEntity` + миграция, `GiftsService`,
   `GiftsController`. Новый `AdminGuard` рядом с `JwtAuthGuard`
   (`backend/src/auth/admin.guard.ts`) — проверяет
   `currentUser.telegramId === process.env.ADMIN_TELEGRAM_ID`.
   `/me` дополняется полем `isAdmin: boolean`.

3. **Frontend**: `AdminGiftsScreen` — пятая вкладка в таббаре, рендерится
   только если `profile.isAdmin`. `App.tsx` начинает реально грузить
   `GET /gifts` и прокидывать результат в `MarketScreen` вместо пустого
   массива по умолчанию.

## Модель данных

Таблица `gifts`:

| Поле | Тип | Источник |
|---|---|---|
| `id` | uuid, PK | генерится |
| `editionNumber` | int | `gift.num` |
| `name` | varchar | `gift.title` |
| `model` | varchar | `StarGiftAttributeModel.name` |
| `symbol` | varchar | `StarGiftAttributePattern.name` |
| `backdropName` | varchar | `StarGiftAttributeBackdrop.name` |
| `backdropColor` | varchar(7) | `center_color` → hex |
| `imageUrl` | varchar | путь к скачанному превью |
| `telegramSlug` | varchar, unique | сам slug (защита от дублей) |
| `priceTon` | numeric | вводится вручную |
| `deletedAt` | timestamptz, null | мягкое удаление |
| `createdAt` | timestamptz | |

1-в-1 ложится на уже существующий фронтовый интерфейс `MarketGift`
(`frontend/src/screens/market/MarketScreen.tsx`) — менять его не требуется.
Поле rarity (redкость в промилле) из API тоже доступно, но нигде не
отображается — в этот подпроект не включается (YAGNI), добавляется отдельным
шагом при запросе.

## API

Публичное:
- `GET /gifts` — список неудалённых подарков, для `MarketScreen`.

Админское (`JwtAuthGuard` + `AdminGuard`):
- `POST /admin/gifts/resolve { link }` — парсит slug из ссылки, вызывает
  резолвер, возвращает preview-данные (ещё не сохранено).
- `POST /admin/gifts { ...поля, priceTon }` — создаёт запись.
- `PATCH /admin/gifts/:id` — редактирование.
- `DELETE /admin/gifts/:id` — мягкое удаление (с подтверждением на фронте).
- `GET /admin/gifts` — список для самой админки (включая только что
  добавленные).

## UI-поток админки

1. Пятая вкладка "Admin" в таббаре (видна только `isAdmin`).
2. Список подарков с ценой и кнопкой удаления (модалка подтверждения).
3. Кнопка "Добавить подарок" → поле для ссылки → "Найти" → дёргает
   `/admin/gifts/resolve`, показывает превью карточки с уже заполненными,
   но редактируемыми полями (на случай если резолвер ошибся) + пустое поле
   цены → "Сохранить" → `POST /admin/gifts`.

## Обработка ошибок

- Невалидная/чужая ссылка → резолвер падает → 400 "Не нашёл подарок по этой
  ссылке".
- Slug уже существует (unique-констрейнт) → 409 "Этот подарок уже есть в
  магазине".
- Резолвер не смог выполниться (сессия разлогинилась и т.п.) → 503 "Сервис
  поиска подарков временно недоступен".
- Скачивание картинки не удалось → не блокирует создание, `imageUrl` пустой,
  дозаполняется вручную при редактировании.
- Таймаут вызова резолвера — 10 секунд → 504.
- Не-админ на admin-роуте → 403 (стандартный `ForbiddenException`).

## Тестирование

TDD, как того требует `CLAUDE.md`. Юнит/e2e-тесты на `GiftsService`/
`GiftsController` (Jest+Supertest, как у `deposits`/`ledger`): CRUD, мягкое
удаление, дубликат по `telegramSlug` → 409, admin-гейт (не-админ → 403),
резолвер в тестах мокается (внешний Python-процесс и реальный Telegram-акк не
гоняем в CI). Сам резолвер-скрипт тестируется вручную на реальном slug (как
уже сделано в рамках этого спека) — юнит-тестов на Python-часть не пишем,
это тонкая обвязка вокруг одного внешнего вызова.

## Вне рамок этого подпроекта

- Анимированные стикеры (tgs/webm) — только статичное превью.
- Отображение редкости (rarity permille).
- Покупка подарка пользователем (кнопка уже есть в `MarketScreen`, ведёт на
  заглушку "скоро").
- Фильтры Тип/Скин/Фон в `AdminGiftsScreen` — список там короткий, не нужны.
