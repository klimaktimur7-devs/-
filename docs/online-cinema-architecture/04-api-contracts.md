# 4. API-контракты (REST + gRPC)

## 4.1. Общие соглашения

Внешний API для клиентов реализован как REST поверх HTTPS (HTTP/2 и HTTP/3), а внутреннее взаимодействие сервисов идёт через gRPC с Protocol Buffers. REST выбран снаружи из-за кэшируемости на edge, простоты отладки и совместимости с любыми клиентами, включая старые ТВ-платформы. gRPC выбран внутри из-за строгих контрактов, бинарной сериализации (в 5–10 раз компактнее JSON), встроенных дедлайнов и потоковой передачи. Ниже перечислены соглашения, общие для всех эндпоинтов.

1. **Версионирование.** Версия мажорная и указывается в пути (`/v1/...`), а обратно совместимые изменения (новые необязательные поля, новые эндпоинты) выпускаются без смены версии. Удаление поля или изменение его смысла требует новой мажорной версии, а старая поддерживается не меньше 18 месяцев, потому что ТВ-приложения обновляются медленно. Клиенты обязаны игнорировать неизвестные поля. Для gRPC действуют правила совместимости Protobuf, которые автоматически проверяет `buf breaking` в CI.

2. **Аутентификация.** Каждый запрос, кроме публичных, несёт заголовок `Authorization: Bearer <access_token>` с JWT (ES256, срок жизни 10 минут). Выбранный профиль передаётся в заголовке `X-Profile-Id` и проверяется на принадлежность аккаунту из токена. Устройство идентифицируется заголовком `X-Device-Id`, который привязан к refresh-токену. Внутри кластера сервисы аутентифицируют друг друга через mTLS с SPIFFE-идентификаторами, а пользовательский контекст передаётся в метаданных gRPC.

3. **Ошибки в формате RFC 9457 (Problem Details).** Все ошибки возвращаются как `application/problem+json` с полями `type`, `title`, `status`, `detail`, `instance`, а также с расширениями `code` (машиночитаемый код) и `trace_id`. Клиент принимает решение по `code`, а не по тексту, поэтому тексты можно локализовать и менять. Коды ошибок стабильны и документированы, например `SUBSCRIPTION_REQUIRED`, `STREAM_LIMIT_REACHED`, `NOT_AVAILABLE_IN_REGION`. Для gRPC используются стандартные коды статуса с деталями в `google.rpc.ErrorInfo`.

4. **Идемпотентность.** Все небезопасные операции с деньгами и состоянием (`POST /subscriptions`, `POST /payment-methods`, `POST /playback/sessions`) принимают заголовок `Idempotency-Key` (UUID, генерируется клиентом). Сервер сохраняет ответ на 24 часа и при повторе с тем же ключом возвращает сохранённый ответ, не выполняя операцию повторно. Повтор с тем же ключом, но другим телом возвращает `422 IDEMPOTENCY_KEY_REUSED`. Методы `PUT` и `DELETE` идемпотентны по своей семантике.

5. **Пагинация курсорами.** Коллекции возвращаются страницами с непрозрачным курсором `next_cursor` (base64 от зашифрованного состояния), а не через `offset`. Курсор устойчив к вставкам во время листания и не требует дорогого `OFFSET` в базе. Размер страницы задаётся параметром `limit` (по умолчанию 20, максимум 100). Отсутствие `next_cursor` в ответе означает конец коллекции.

6. **Лимиты запросов.** Лимиты применяются на шлюзе по аккаунту, устройству и IP, а в ответах возвращаются заголовки `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (по черновику IETF). При превышении возвращается `429` с заголовком `Retry-After`. Лимиты различаются по классам эндпоинтов: вход в аккаунт ограничен жёстко (защита от перебора паролей), чтение каталога — мягко. Клиентские SDK реализуют экспоненциальную задержку со случайным разбросом.

7. **Кэширование и условные запросы.** Публичные ответы каталога содержат `Cache-Control: public, max-age=300, stale-while-revalidate=600` и `ETag`, и edge кэширует их по ключу, включающему локаль и страну. Персонализированные ответы помечены `Cache-Control: private, no-store`. Клиенты используют `If-None-Match` и получают `304 Not Modified` без тела. Изображения отдаются с неизменяемыми URL, содержащими хеш содержимого, и `max-age` в один год.

8. **Трассировка и корреляция.** Шлюз принимает или генерирует заголовок `traceparent` (W3C Trace Context) и пробрасывает его во все внутренние вызовы. Идентификатор трассировки возвращается в ответе в заголовке `X-Trace-Id` и в теле ошибок. Это позволяет поддержке найти полную трассировку по обращению пользователя. Клиенты передают версию приложения и платформу в `User-Agent` в стандартизованном формате.

## 4.2. Сводная таблица REST-эндпоинтов

| Метод | Путь | Назначение | Аутентификация | Кэш на edge |
|-------|------|------------|----------------|-------------|
| POST | `/v1/auth/register` | Регистрация аккаунта | нет | нет |
| POST | `/v1/auth/login` | Вход по паролю | нет | нет |
| POST | `/v1/auth/passkey/options` | Параметры входа по passkey | нет | нет |
| POST | `/v1/auth/passkey/verify` | Проверка passkey | нет | нет |
| POST | `/v1/auth/mfa/verify` | Второй фактор | MFA-токен | нет |
| POST | `/v1/auth/token/refresh` | Обновление токенов | refresh-токен | нет |
| POST | `/v1/auth/logout` | Выход (отзыв семейства) | да | нет |
| POST | `/v1/auth/device/code` | Код для ТВ (RFC 8628) | нет | нет |
| POST | `/v1/auth/device/token` | Опрос статуса кода ТВ | нет | нет |
| POST | `/v1/auth/device/approve` | Подтверждение кода с телефона | да | нет |
| GET | `/v1/me` | Аккаунт, подписка, профили | да | нет |
| PATCH | `/v1/me` | Изменение настроек аккаунта | да | нет |
| DELETE | `/v1/me` | Удаление аккаунта | да + повторный вход | нет |
| GET | `/v1/profiles` | Список профилей | да | нет |
| POST | `/v1/profiles` | Создать профиль | да | нет |
| PATCH | `/v1/profiles/{profile_id}` | Изменить профиль | да | нет |
| DELETE | `/v1/profiles/{profile_id}` | Удалить профиль | да | нет |
| GET | `/v1/devices` | Устройства аккаунта | да | нет |
| DELETE | `/v1/devices/{device_id}` | Отозвать устройство | да | нет |
| GET | `/v1/plans` | Тарифы для страны | нет | да, 5 мин |
| POST | `/v1/subscriptions` | Оформить подписку | да | нет |
| GET | `/v1/subscriptions/current` | Текущая подписка | да | нет |
| PATCH | `/v1/subscriptions/current` | Сменить тариф | да | нет |
| POST | `/v1/subscriptions/current/cancel` | Отменить подписку | да | нет |
| POST | `/v1/subscriptions/current/resume` | Возобновить подписку | да | нет |
| GET | `/v1/invoices` | Счета | да | нет |
| POST | `/v1/payment-methods` | Добавить метод оплаты | да | нет |
| DELETE | `/v1/payment-methods/{id}` | Удалить метод оплаты | да | нет |
| POST | `/v1/webhooks/payments/{provider}` | Вебхук платёжного провайдера | подпись | нет |
| GET | `/v1/home` | Главная страница (строки) | да | нет |
| GET | `/v1/titles/{title_id}` | Карточка тайтла | да | да, 5 мин (публичная часть) |
| GET | `/v1/titles/{title_id}/seasons/{n}/episodes` | Эпизоды сезона | да | да, 5 мин |
| GET | `/v1/titles/{title_id}/similar` | Похожие тайтлы | да | нет |
| GET | `/v1/genres/{genre_id}/titles` | Тайтлы жанра | да | да, 5 мин |
| GET | `/v1/search` | Поиск | да | нет |
| GET | `/v1/search/suggest` | Подсказки при вводе | да | да, 1 мин |
| POST | `/v1/playback/sessions` | Старт воспроизведения | да | нет |
| POST | `/v1/playback/sessions/{id}/heartbeat` | Heartbeat + позиция | да | нет |
| DELETE | `/v1/playback/sessions/{id}` | Завершение сессии | да | нет |
| POST | `/v1/drm/license/{system}` | DRM-лицензия | сессионный токен | нет |
| GET | `/v1/drm/fairplay/certificate` | Сертификат FairPlay | нет | да, 1 день |
| POST | `/v1/downloads` | Офлайн-загрузка (лицензия) | да | нет |
| DELETE | `/v1/downloads/{download_id}` | Удаление загрузки | да | нет |
| PUT | `/v1/profiles/{pid}/progress/{playable_id}` | Сохранить позицию | да | нет |
| GET | `/v1/profiles/{pid}/continue-watching` | «Продолжить просмотр» | да | нет |
| GET | `/v1/profiles/{pid}/history` | История просмотров | да | нет |
| DELETE | `/v1/profiles/{pid}/history/{playable_id}` | Скрыть из истории | да | нет |
| GET | `/v1/profiles/{pid}/my-list` | «Мой список» | да | нет |
| PUT | `/v1/profiles/{pid}/my-list/{title_id}` | Добавить в список | да | нет |
| DELETE | `/v1/profiles/{pid}/my-list/{title_id}` | Удалить из списка | да | нет |
| PUT | `/v1/profiles/{pid}/ratings/{title_id}` | Оценить тайтл | да | нет |
| POST | `/v1/events` | Пакет телеметрии | да | нет |
| GET | `/v1/config` | Конфигурация клиента и флаги | нет | да, 1 мин |

## 4.3. Детальные схемы ключевых REST-эндпоинтов

### Регистрация и вход

```http
POST /v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "correct horse battery staple",
  "country_code": "DE",
  "locale": "de-DE",
  "marketing_consent": false,
  "captcha_token": "..."
}
```

```http
HTTP/1.1 201 Created
{
  "account_id": "01928f3e-7c1a-7b3e-9f00-2a4e1c9d8b11",
  "status": "pending_verification",
  "tokens": {
    "access_token": "eyJhbGciOiJFUzI1NiIsImtpZCI6ImsxIn0...",
    "token_type": "Bearer",
    "expires_in": 600,
    "refresh_token": "rt_7PqL...",
    "refresh_expires_in": 7776000
  }
}
```

```http
POST /v1/auth/login
{
  "email": "user@example.com",
  "password": "...",
  "device": { "device_id": "3f2a...", "platform": "android", "model": "Pixel 9", "app_version": "5.12.0",
              "drm_system": "widevine", "drm_security_level": "L1" }
}
```

Ответ `200` совпадает по структуре с полем `tokens` выше. Если у аккаунта включена MFA, возвращается `200` с `{"mfa_required": true, "mfa_token": "...", "methods": ["totp", "email_otp"]}`, и клиент продолжает через `/v1/auth/mfa/verify`. Неверные учётные данные возвращают `401` с кодом `INVALID_CREDENTIALS`, а после 5 неудачных попыток за 15 минут — `429` с `LOGIN_THROTTLED`, без различия между «нет такого e-mail» и «неверный пароль».

### Обновление токенов

```http
POST /v1/auth/token/refresh
{ "refresh_token": "rt_7PqL...", "device_id": "3f2a..." }

HTTP/1.1 200 OK
{ "access_token": "eyJ...", "expires_in": 600, "refresh_token": "rt_9XyZ...", "refresh_expires_in": 7776000 }
```

Старый refresh-токен становится недействительным сразу после успешного обновления. Повторное предъявление уже использованного токена возвращает `401 TOKEN_REUSED` и отзывает всё семейство: это сигнал возможной кражи токена.

### Device flow для ТВ

```http
POST /v1/auth/device/code
{ "client_id": "tv-tizen", "device": { "device_id": "...", "platform": "tizen", "model": "QN90D" } }

HTTP/1.1 200 OK
{ "device_code": "dc_Hq...", "user_code": "WDJB-MJHT", "verification_uri": "https://example.tv/activate",
  "verification_uri_complete": "https://example.tv/activate?code=WDJB-MJHT", "expires_in": 600, "interval": 5 }

POST /v1/auth/device/token
{ "device_code": "dc_Hq..." }
-> 400 { "code": "AUTHORIZATION_PENDING" }   // пока пользователь не подтвердил
-> 200 { "access_token": "...", "refresh_token": "...", ... }   // после подтверждения
```

### Профиль и аккаунт

```http
GET /v1/me
HTTP/1.1 200 OK
{
  "account_id": "01928f3e-...",
  "email_masked": "u***@example.com",
  "country_code": "DE",
  "subscription": { "plan_code": "premium", "status": "active", "current_period_end": "2026-10-27T00:00:00Z",
                    "max_streams": 4, "max_resolution": "2160p" },
  "profiles": [
    { "profile_id": "01928f3f-...", "display_name": "Анна", "avatar_id": "av_12", "is_kids": false,
      "maturity_level": 100, "ui_language": "ru-RU", "has_pin": true }
  ]
}

POST /v1/profiles
{ "display_name": "Дети", "avatar_id": "av_31", "is_kids": true, "ui_language": "ru-RU" }
-> 201 { "profile_id": "...", ... }
-> 409 { "code": "PROFILE_LIMIT_REACHED" }   // уже 5 профилей
```

### Тарифы и подписка

```http
GET /v1/plans?country=DE
HTTP/1.1 200 OK
Cache-Control: public, max-age=300
{
  "country_code": "DE", "currency": "EUR",
  "plans": [
    { "code": "basic_ads", "price_minor": 499, "tax_inclusive": true, "max_streams": 2, "max_resolution": "1080p",
      "hdr": false, "downloads_devices": 0, "has_ads": true },
    { "code": "standard", "price_minor": 1299, "tax_inclusive": true, "max_streams": 2, "max_resolution": "1080p",
      "hdr": false, "downloads_devices": 2, "has_ads": false },
    { "code": "premium", "price_minor": 1999, "tax_inclusive": true, "max_streams": 4, "max_resolution": "2160p",
      "hdr": true, "downloads_devices": 6, "has_ads": false }
  ]
}
```

```http
POST /v1/subscriptions
Idempotency-Key: 6b1f8c4e-3a2d-4c5b-9e7f-1a2b3c4d5e6f
{ "plan_code": "premium", "payment_method_id": "pm_01928f...", "promo_code": null }

HTTP/1.1 201 Created
{ "subscription_id": "...", "status": "active", "plan_code": "premium",
  "current_period_start": "2026-09-27T12:00:00Z", "current_period_end": "2026-10-27T12:00:00Z",
  "latest_invoice": { "invoice_id": "...", "total_minor": 1999, "currency": "EUR", "status": "paid" } }

HTTP/1.1 402 Payment Required
{ "type": "https://errors.example.tv/payment-declined", "title": "Платёж отклонён", "status": 402,
  "code": "PAYMENT_DECLINED", "detail": "Банк отклонил операцию", "decline_code": "insufficient_funds",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736" }

HTTP/1.1 202 Accepted          // требуется 3-D Secure
{ "status": "requires_action", "action": { "type": "redirect", "url": "https://psp.example/3ds/..." } }
```

```http
PATCH /v1/subscriptions/current
{ "plan_code": "standard", "effective": "next_period" }     // или "immediately" (с перерасчётом)
POST /v1/subscriptions/current/cancel
{ "reason": "too_expensive", "feedback": "..." }
-> 200 { "status": "active", "cancel_at_period_end": true, "access_until": "2026-10-27T12:00:00Z" }
```

### Главная страница и каталог

```http
GET /v1/home?rows=12&cursor=
X-Profile-Id: 01928f3f-...

HTTP/1.1 200 OK
{
  "rows": [
    { "row_id": "continue_watching", "title": "Продолжить просмотр", "layout": "progress",
      "items": [ { "title_id": "...", "playable_id": "...", "name": "Тёмный лес", "subtitle": "С2:Э5",
                   "progress": 0.42, "artwork": { "url": "https://img.example.tv/a1b2.jpg", "w": 640, "h": 360 } } ] },
    { "row_id": "because_you_watched:0192...", "title": "Потому что вы смотрели «Тёмный лес»", "layout": "standard",
      "items": [ ... ] }
  ],
  "next_cursor": "eyJyIjoxMn0",
  "degraded": false
}
```

Поле `degraded: true` означает, что часть строк получена из резервного неперсонализированного источника. Клиент может показать её без изменений и запросить главную заново позже.

```http
GET /v1/titles/0192a1b2-...?locale=ru-RU
HTTP/1.1 200 OK
ETag: "c-8f3a2b"
{
  "title_id": "0192a1b2-...", "kind": "series", "name": "Тёмный лес", "synopsis": "...",
  "release_year": 2025, "maturity": { "rating": "16+", "descriptors": ["violence"] },
  "genres": [ { "genre_id": 12, "name": "Триллер" } ],
  "seasons": [ { "season_number": 1, "episode_count": 8 }, { "season_number": 2, "episode_count": 8 } ],
  "cast": [ { "person_id": "...", "name": "Иван Петров", "character": "Следователь" } ],
  "artwork": { "poster": "https://img.example.tv/...", "backdrop": "https://img.example.tv/..." },
  "availability": { "available": true, "max_resolution": "2160p", "hdr": ["HDR10", "DolbyVision"],
                    "audio": ["ru", "en"], "subtitles": ["ru", "en", "de"] },
  "user": { "in_my_list": true, "rating": 1, "resume": { "playable_id": "...", "position_ms": 1234000 } }
}
```

Публичная часть карточки кэшируется на edge, а блок `user` BFF подмешивает отдельно из сервиса прогресса. Поэтому пользовательские данные никогда не попадают в общий кэш.

### Поиск

```http
GET /v1/search?q=тёмн&limit=20&cursor=
{ "results": [ { "type": "title", "title_id": "...", "name": "Тёмный лес", "year": 2025, "artwork": "..." },
               { "type": "person", "person_id": "...", "name": "Тёмкин Сергей" } ],
  "next_cursor": "...", "corrected_query": null }

GET /v1/search/suggest?q=тём
{ "suggestions": [ "тёмный лес", "тёмная материя", "тёмные воды" ] }
```

### Воспроизведение

```http
POST /v1/playback/sessions
Idempotency-Key: 9a8b7c6d-...
X-Profile-Id: 01928f3f-...
{
  "playable_id": "0192c3d4-...",
  "device": { "device_id": "...", "drm_system": "widevine", "drm_security_level": "L1", "hdcp": "2.2",
              "codecs": ["av01", "hvc1", "avc1"], "hdr": ["HDR10"], "max_resolution": "2160p" },
  "network": { "type": "wifi", "estimated_kbps": 45000 },
  "start_position_ms": null,
  "audio_language": "ru",
  "subtitle_language": null
}

HTTP/1.1 201 Created
{
  "session_id": "ps_0192d5e6-...",
  "manifests": [
    { "cdn": "oc", "priority": 1, "url": "https://oc-fra3.edge.example.tv/v1/m/0192c3d4/master.mpd?tok=eyJ..." },
    { "cdn": "cdn-b", "priority": 2, "url": "https://b.cdn.example.tv/v1/m/0192c3d4/master.mpd?tok=eyJ..." }
  ],
  "format": "dash",
  "drm": { "system": "widevine", "license_url": "https://license.example.tv/v1/drm/license/widevine",
           "session_token": "lt_eyJ..." },
  "start_position_ms": 1234000,
  "heartbeat_interval_s": 60,
  "markers": { "intro": [30000, 95000], "credits_start_ms": 3120000 },
  "next_playable_id": "0192c3d5-...",
  "max_resolution": "2160p"
}

HTTP/1.1 403 Forbidden
{ "code": "STREAM_LIMIT_REACHED", "status": 403, "title": "Достигнут лимит одновременных просмотров",
  "active_streams": [ { "device_name": "Гостиная ТВ", "title": "Тёмный лес", "started_at": "..." } ],
  "max_streams": 2, "upgrade_available": true }
```

```http
POST /v1/playback/sessions/ps_0192d5e6-.../heartbeat
{ "position_ms": 1294000, "state": "playing", "bitrate_kbps": 8200, "buffer_ms": 24000 }
-> 200 { "continue": true, "next_heartbeat_s": 60 }
-> 409 { "code": "SESSION_EVICTED", "reason": "stream_limit" }  // слот забран другим устройством владельца

DELETE /v1/playback/sessions/ps_0192d5e6-...?position_ms=1350000
-> 204
```

### DRM-лицензия

```http
POST /v1/drm/license/widevine
Authorization: Bearer lt_eyJ...          // сессионный токен лицензии, не access-токен
Content-Type: application/octet-stream
<бинарный license challenge от CDM>

HTTP/1.1 200 OK
Content-Type: application/octet-stream
<бинарная лицензия>
```

Для FairPlay клиент сначала получает сертификат через `GET /v1/drm/fairplay/certificate`, а затем отправляет SPC на `/v1/drm/license/fairplay` и получает CKC. Ошибки лицензирования возвращаются как Problem Details с кодами `DRM_DEVICE_REVOKED`, `DRM_SECURITY_LEVEL_TOO_LOW`, `DRM_SESSION_EXPIRED` и `HDCP_REQUIRED`.

### Прогресс, история, списки, оценки

```http
PUT /v1/profiles/{pid}/progress/{playable_id}
{ "position_ms": 1350000, "duration_ms": 3300000, "event_time": "2026-09-27T20:14:05.123Z", "device_id": "..." }
-> 204

GET /v1/profiles/{pid}/continue-watching?limit=20
{ "items": [ { "title_id": "...", "playable_id": "...", "position_ms": 1350000, "duration_ms": 3300000,
               "updated_at": "..." } ], "next_cursor": null }

GET /v1/profiles/{pid}/history?month=2026-09&limit=50
PUT /v1/profiles/{pid}/my-list/{title_id}          -> 204
DELETE /v1/profiles/{pid}/my-list/{title_id}       -> 204
PUT /v1/profiles/{pid}/ratings/{title_id}   { "rating": 2 }   -> 204
```

Поле `event_time` задаётся клиентом и используется для разрешения конфликтов: запись с более ранним временем события не перезапишет более позднюю. Это важно, когда два устройства одного профиля отправляют позиции с задержкой из-за плохой сети.

### Телеметрия

```http
POST /v1/events
Content-Encoding: gzip
{
  "schema": "playback.v3",
  "session_id": "ps_0192d5e6-...",
  "events": [
    { "t": "2026-09-27T20:14:05.123Z", "type": "start", "startup_ms": 980, "bitrate_kbps": 3000, "cdn": "oc", "pop": "fra3" },
    { "t": "2026-09-27T20:14:35.004Z", "type": "bitrate_switch", "from": 3000, "to": 8200 },
    { "t": "2026-09-27T20:15:02.771Z", "type": "rebuffer", "duration_ms": 420 }
  ]
}
-> 202 Accepted
```

### Офлайн-загрузки

```http
POST /v1/downloads
{ "playable_id": "...", "quality": "hd", "device_id": "..." }
-> 201 { "download_id": "...", "manifest_url": "...", "license": { "url": "...", "session_token": "...",
         "rental_duration_s": 2592000, "playback_duration_s": 172800 } }
-> 409 { "code": "DOWNLOAD_DEVICE_LIMIT" }
```

## 4.4. Внутренние gRPC-контракты

Все внутренние контракты хранятся в одном репозитории схем, собираются `buf` и публикуются как пакеты Go и Python. Ниже приведены ключевые сервисы.

```protobuf
syntax = "proto3";
package platform.auth.v1;
option go_package = "platform/gen/auth/v1;authv1";

import "google/protobuf/timestamp.proto";

service TokenService {
  // Проверка токена там, где локальная проверка подписи недостаточна (например, отозванные устройства).
  rpc Introspect(IntrospectRequest) returns (IntrospectResponse);
  // Выпуск сессионного токена для лицензионного сервера.
  rpc IssueLicenseToken(IssueLicenseTokenRequest) returns (IssueLicenseTokenResponse);
  // Отзыв всех токенов аккаунта или устройства.
  rpc Revoke(RevokeRequest) returns (RevokeResponse);
}

message IntrospectRequest { string access_token = 1; }
message IntrospectResponse {
  bool active = 1;
  string account_id = 2;
  string device_id = 3;
  string home_region = 4;
  int32 cell_id = 5;
  repeated string scopes = 6;
  google.protobuf.Timestamp expires_at = 7;
}
message IssueLicenseTokenRequest {
  string session_id = 1; string account_id = 2; string device_id = 3;
  repeated string key_ids = 4; string max_resolution = 5; int32 ttl_seconds = 6;
}
message IssueLicenseTokenResponse { string token = 1; google.protobuf.Timestamp expires_at = 2; }
message RevokeRequest { string account_id = 1; string device_id = 2; string reason = 3; }
message RevokeResponse { int32 revoked_count = 1; }
```

```protobuf
syntax = "proto3";
package platform.entitlement.v1;

service EntitlementService {
  rpc Check(CheckRequest) returns (CheckResponse);
  rpc CheckBatch(CheckBatchRequest) returns (CheckBatchResponse);   // для строк главной (доступность)
}

enum DeviceClass { DEVICE_CLASS_UNSPECIFIED = 0; SW_DRM = 1; HW_DRM = 2; }
enum Decision {
  DECISION_UNSPECIFIED = 0; ALLOW = 1; DENY_NO_SUBSCRIPTION = 2; DENY_REGION = 3;
  DENY_MATURITY = 4; DENY_PLAN = 5; DENY_NOT_YET_AVAILABLE = 6;
}

message CheckRequest {
  string account_id = 1; string profile_id = 2; string playable_id = 3;
  string country = 4; DeviceClass device_class = 5;
}
message CheckResponse {
  Decision result = 1;
  string max_resolution = 2;         // min(тариф, лицензия, устройство)
  bool hdr_allowed = 3;
  bool offline_allowed = 4;
  int32 max_streams = 5;
  int32 cache_ttl_seconds = 6;
}
message CheckBatchRequest { string account_id = 1; string profile_id = 2; repeated string playable_ids = 3; string country = 4; }
message CheckBatchResponse { map<string, Decision> results = 1; }
```

```protobuf
syntax = "proto3";
package platform.catalog.v1;

service CatalogService {
  rpc GetTitles(GetTitlesRequest) returns (GetTitlesResponse);             // пакетно до 100
  rpc GetPlayable(GetPlayableRequest) returns (Playable);
  rpc GetPlaybackAsset(GetPlaybackAssetRequest) returns (PlaybackAsset);   // рендишены, дорожки, KID
  rpc WatchChanges(WatchChangesRequest) returns (stream CatalogChange);    // поток изменений для кэшей
}

message GetTitlesRequest { repeated string title_ids = 1; string locale = 2; string country = 3; }
message GetTitlesResponse { map<string, Title> titles = 1; }
message Title {
  string title_id = 1; string kind = 2; string name = 3; string synopsis = 4;
  int32 release_year = 5; string maturity_rating = 6; int32 maturity_normalized = 7;
  repeated int32 genre_ids = 8; map<string, string> artwork = 9; float popularity = 10;
}
message GetPlayableRequest { string playable_id = 1; string locale = 2; }
message Playable {
  string playable_id = 1; string title_id = 2; int32 season = 3; int32 episode = 4;
  int64 duration_ms = 5; int64 intro_start_ms = 6; int64 intro_end_ms = 7; int64 credits_start_ms = 8;
  string next_playable_id = 9;
}
message GetPlaybackAssetRequest { string playable_id = 1; repeated string codecs = 2; string max_resolution = 3; }
message PlaybackAsset {
  string asset_id = 1; string storage_prefix = 2;
  repeated Rendition renditions = 3; repeated Track audio = 4; repeated Track subtitles = 5;
  repeated string key_ids = 6;
}
message Rendition { string codec = 1; int32 width = 2; int32 height = 3; int32 bitrate_kbps = 4; string hdr = 5; string min_security = 6; }
message Track { string language = 1; string kind = 2; string codec = 3; string channels = 4; }
message WatchChangesRequest { string from_offset = 1; }
message CatalogChange { string entity = 1; string id = 2; string op = 3; string offset = 4; }
```

```protobuf
syntax = "proto3";
package platform.playback.v1;

service ConcurrencyService {
  rpc Acquire(AcquireRequest) returns (AcquireResponse);
  rpc Heartbeat(HeartbeatRequest) returns (HeartbeatResponse);
  rpc Release(ReleaseRequest) returns (ReleaseResponse);
  rpc ListActive(ListActiveRequest) returns (ListActiveResponse);
}
message AcquireRequest { string account_id = 1; string session_id = 2; string device_id = 3; int32 max_streams = 4; }
message AcquireResponse { bool granted = 1; repeated ActiveStream active = 2; }
message ActiveStream { string session_id = 1; string device_id = 2; string playable_id = 3; int64 last_heartbeat_unix = 4; }
message HeartbeatRequest { string account_id = 1; string session_id = 2; }
message HeartbeatResponse { bool alive = 1; }
message ReleaseRequest { string account_id = 1; string session_id = 2; }
message ReleaseResponse {}
message ListActiveRequest { string account_id = 1; }
message ListActiveResponse { repeated ActiveStream active = 1; }

service SteeringService {
  rpc Select(SelectRequest) returns (SelectResponse);
}
message SelectRequest {
  string country = 1; uint32 asn = 2; string client_ip_prefix = 3; string device_type = 4;
  string playable_id = 5; int64 expected_kbps = 6;
}
message SelectResponse { repeated CdnChoice choices = 1; string decision_id = 2; }
message CdnChoice { string cdn = 1; string host = 2; float weight = 3; int32 priority = 4; }

service ProgressService {
  rpc Save(SaveProgressRequest) returns (SaveProgressResponse);
  rpc GetResume(GetResumeRequest) returns (GetResumeResponse);
  rpc GetContinueWatching(GetContinueWatchingRequest) returns (GetContinueWatchingResponse);
}
message SaveProgressRequest {
  string profile_id = 1; string playable_id = 2; string title_id = 3;
  int64 position_ms = 4; int64 duration_ms = 5; int64 event_time_unix_ms = 6; string device_id = 7;
}
message SaveProgressResponse { bool applied = 1; }        // false — пришла более старая запись
message GetResumeRequest { string profile_id = 1; string playable_id = 2; }
message GetResumeResponse { int64 position_ms = 1; bool completed = 2; }
message GetContinueWatchingRequest { string profile_id = 1; int32 limit = 2; }
message GetContinueWatchingResponse { repeated ResumeItem items = 1; }
message ResumeItem { string title_id = 1; string playable_id = 2; int64 position_ms = 3; int64 duration_ms = 4; int64 updated_unix_ms = 5; }

service RecommendationService {
  rpc GetHomeRows(GetHomeRowsRequest) returns (GetHomeRowsResponse);
  rpc GetSimilar(GetSimilarRequest) returns (GetSimilarResponse);
}
message GetHomeRowsRequest { string profile_id = 1; string country = 2; string device_type = 3; int32 max_rows = 4; int32 items_per_row = 5; }
message GetHomeRowsResponse { repeated Row rows = 1; bool fallback = 2; string model_version = 3; }
message Row { string row_id = 1; string title_key = 2; repeated string title_ids = 3; }
message GetSimilarRequest { string title_id = 1; string profile_id = 2; int32 limit = 3; }
message GetSimilarResponse { repeated string title_ids = 1; }
```

```protobuf
syntax = "proto3";
package platform.keys.v1;

// Доступен только лицензионным серверам и упаковщику (авторизация по SPIFFE ID).
service KeyService {
  rpc CreateKeys(CreateKeysRequest) returns (CreateKeysResponse);
  rpc GetContentKeys(GetContentKeysRequest) returns (GetContentKeysResponse);
}
message CreateKeysRequest { string asset_id = 1; repeated string track_classes = 2; }
message CreateKeysResponse { repeated ContentKey keys = 1; }
message GetContentKeysRequest { repeated string key_ids = 1; string purpose = 2; string session_id = 3; }
message GetContentKeysResponse { repeated ContentKey keys = 1; }
message ContentKey { string key_id = 1; bytes key = 2; string track_class = 3; }   // key только в памяти, по mTLS
```

## 4.5. Реализация эндпоинта старта воспроизведения (Go)

```go
func (h *PlaybackHandler) CreateSession(ctx context.Context, req *CreateSessionRequest, u UserCtx) (*CreateSessionResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 80*time.Millisecond) // бюджет всего эндпоинта
	defer cancel()

	g, gctx := errgroup.WithContext(ctx)
	var ent *entv1.CheckResponse
	var asset *catv1.PlaybackAsset
	var cdn *pbv1.SelectResponse

	g.Go(func() (err error) {
		ent, err = h.entitlement.Check(gctx, &entv1.CheckRequest{
			AccountId: u.AccountID, ProfileId: u.ProfileID, PlayableId: req.PlayableID,
			Country: u.Country, DeviceClass: deviceClass(req.Device),
		})
		return err
	})
	g.Go(func() (err error) {
		asset, err = h.catalog.GetPlaybackAsset(gctx, &catv1.GetPlaybackAssetRequest{
			PlayableId: req.PlayableID, Codecs: req.Device.Codecs, MaxResolution: req.Device.MaxResolution,
		})
		return err
	})
	g.Go(func() (err error) {
		cdn, err = h.steering.Select(gctx, &pbv1.SelectRequest{Country: u.Country, Asn: u.ASN, DeviceType: req.Device.Platform})
		if err != nil { // Steering некритичен: при отказе используем статический список.
			cdn, err = h.staticCDNs(u.Country), nil
		}
		return err
	})
	if err := g.Wait(); err != nil {
		return nil, mapUpstreamError(err)
	}
	if ent.Result != entv1.Decision_ALLOW {
		return nil, problemFromDecision(ent.Result)
	}

	sessionID := newSessionID()
	acq, err := h.concurrency.Acquire(ctx, &pbv1.AcquireRequest{
		AccountId: u.AccountID, SessionId: sessionID, DeviceId: u.DeviceID, MaxStreams: ent.MaxStreams,
	})
	if err != nil {
		h.log.Warn("concurrency unavailable, fail-open", "account", u.AccountID)
	} else if !acq.Granted {
		return nil, streamLimitProblem(acq.Active, ent.MaxStreams)
	}

	lt, err := h.tokens.IssueLicenseToken(ctx, &authv1.IssueLicenseTokenRequest{
		SessionId: sessionID, AccountId: u.AccountID, DeviceId: u.DeviceID,
		KeyIds: filterKeys(asset, ent.MaxResolution), MaxResolution: ent.MaxResolution, TtlSeconds: 6 * 3600,
	})
	if err != nil {
		return nil, mapUpstreamError(err)
	}

	resume := h.resumePosition(ctx, u.ProfileID, req.PlayableID, req.StartPositionMs) // тайм-аут 10 мс, иначе 0
	return &CreateSessionResponse{
		SessionID:         sessionID,
		Manifests:         h.signer.SignManifests(cdn.Choices, asset, ent.MaxResolution, 6*time.Hour),
		DRM:               drmInfo(req.Device.DRMSystem, lt.Token),
		StartPositionMs:   resume,
		HeartbeatInterval: 60,
		MaxResolution:     ent.MaxResolution,
	}, nil
}
```

## 4.6. Альтернативы и почему не выбраны

1. **GraphQL как внешний API.** GraphQL позволяет клиенту запросить ровно нужные поля одним запросом и хорошо подходит для экранов со сложной структурой. Однако он плохо кэшируется на edge (обычно это POST с телом запроса), требует защиты от дорогих запросов (ограничение глубины и сложности) и усложняет лимитирование по эндпоинтам. Наши BFF уже решают задачу «один запрос на экран» и оптимизированы под устройство. GraphQL может появиться позже внутри Web-BFF, но не как публичный контракт для всех устройств.

2. **gRPC-Web или Connect как внешний API.** Использование одного протокола снаружи и внутри выглядит элегантно и даёт строгие контракты для клиентов. Но многие ТВ-платформы и старые браузеры ограничены в поддержке HTTP/2-трейлеров и бинарных потоков, а отладка бинарного протокола через инструменты разработчика заметно сложнее. Edge-кэширование и WAF-правила для Protobuf-тел также менее зрелые. REST с JSON и сжатием оказывается практичнее на внешнем периметре.

3. **REST/JSON и для внутреннего взаимодействия.** Единый стиль упрощает инструменты и обучение. Но внутренние вызовы составляют сотни тысяч RPS на каждый сервис горячего пути, и сериализация JSON стоит заметного CPU, а отсутствие строгой схемы приводит к ошибкам совместимости между командами. gRPC даёт встроенное распространение дедлайнов, что критично для бюджета в 100 мс. Автоматическая проверка обратной совместимости Protobuf-схем в CI устраняет целый класс инцидентов.

4. **WebSocket для heartbeat и прогресса.** Постоянное соединение уменьшает накладные расходы на заголовки и позволяет серверу отправлять команды клиенту (например, «сессия вытеснена»). Но 4 миллиона постоянных соединений требуют отдельной инфраструктуры с состоянием, усложняют балансировку и перезапуски подов, а на мобильных сетях соединения часто рвутся. Heartbeat раз в 60 секунд по HTTP/2 или HTTP/3 с переиспользованием соединения обходится дёшево. Серверные команды доставляются в ответе на heartbeat с задержкой до минуты, что приемлемо.

5. **Версионирование через заголовки или media type.** Версия в заголовке `Accept` считается более «чистой» с точки зрения REST. На практике она хуже видна в логах, сложнее для кэширования на edge (кэш нужно варьировать по заголовку) и неудобна при ручной отладке. Версия в пути прозрачна для всех инструментов, от WAF до дашбордов. Мы также избегаем дат в версиях, потому что при медленных обновлениях ТВ-клиентов это создаёт слишком много одновременно поддерживаемых версий.

6. **Offset-пагинация.** Параметры `offset` и `limit` привычны и позволяют перейти на произвольную страницу. Но при больших смещениях базы данных читают и отбрасывают все предыдущие строки, а при вставке новых элементов во время листания пользователь видит дубликаты или пропуски. В Cassandra offset-пагинация вообще не поддерживается эффективно. Курсоры решают обе проблемы, а произвольный переход на страницу в интерфейсе стриминга не нужен.
