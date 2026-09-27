# 3. Модель данных

## 3.1. Принципы моделирования

Модель данных разбита по доменам, и у каждого домена своё хранилище. Прямые связи между хранилищами разных доменов (внешние ключи, JOIN между базами) запрещены: связь выражается через идентификаторы и события. Ниже перечислены принципы, которым следуют все схемы.

1. **Идентификаторы — UUIDv7.** Все первичные ключи генерируются как UUID версии 7, которые содержат временную метку в старших битах. Благодаря этому вставки в B-tree индексы PostgreSQL почти последовательны и не вызывают фрагментации, как случайные UUIDv4. Такие идентификаторы генерируются без координации в любом регионе и не раскрывают количество пользователей, в отличие от автоинкремента. В Cassandra UUIDv7 также удобен как кластерный ключ, упорядоченный по времени.

2. **Деньги — в минимальных единицах валюты.** Все суммы хранятся как `bigint` в минимальных единицах (центах, копейках, иенах) вместе с кодом валюты ISO 4217. Числа с плавающей точкой для денег запрещены, потому что они дают ошибки округления при суммировании. Налоги, скидки и итоговые суммы хранятся отдельными полями, чтобы счёт можно было воспроизвести при аудите. Конвертация валют выполняется только при отображении и в аналитике, никогда при списании.

3. **Время — в UTC с часовым поясом.** Все временные метки в PostgreSQL хранятся как `timestamptz`, в Cassandra — как `timestamp` в UTC. Локальное время пользователя вычисляется на клиенте из его настроек. Лицензионные окна задаются в UTC с явным указанием момента начала и окончания, поскольку правообладатели часто договариваются о «полуночи по местному времени», и это переводится в UTC при вводе в CMS. Такая дисциплина исключает целый класс ошибок, связанных с переходом на летнее время.

4. **Мягкое удаление только там, где оно нужно по закону или бизнесу.** Для аккаунтов используется статус `deleted` и отложенное физическое удаление через 30 дней. Этот период позволяет восстановить аккаунт по запросу, после чего данные стираются окончательно по GDPR. Для платёжных документов удаления нет вообще: счета хранятся по требованиям налогового законодательства, но персональные данные в них псевдонимизируются. Для остальных сущностей используется физическое удаление, чтобы не усложнять запросы вечными фильтрами `WHERE deleted_at IS NULL`.

5. **Денормализация на стороне чтения.** Источник истины нормализован (PostgreSQL), а представления для чтения (кэш, поисковый индекс, строки рекомендаций в Cassandra) денормализованы и строятся из событий. Это позволяет источнику истины оставаться простым и корректным, а читающей стороне — отвечать за одну операцию. Представления можно перестроить с нуля, перечитав события из Kafka или выполнив полный экспорт. Задержка распространения изменений (обычно секунды) явно учитывается в продуктовых требованиях.

6. **Персональные данные изолированы.** Поля с персональными данными (e-mail, имя, телефон, IP-адрес) хранятся только в домене «Идентичность и аккаунты» и шифруются на уровне приложения ключом, уникальным для аккаунта. Остальные домены оперируют только `account_id` и `profile_id`. Удаление ключа аккаунта (crypto-shredding) делает его персональные данные нечитаемыми во всех резервных копиях сразу. Аналитика работает с псевдонимизированными идентификаторами.

## 3.2. Карта хранилищ

| Домен | Хранилище | Кластер | Объём | Ключ шардирования |
|-------|-----------|---------|-------|-------------------|
| Идентичность и аккаунты | PostgreSQL + Citus | `identity-{region}` | ~0,6 ТБ | `account_id` |
| Коммерция | PostgreSQL + Citus | `commerce-{region}` | ~1,2 ТБ (растёт) | `account_id` |
| Каталог | PostgreSQL | `catalog` (+ реплики) | ~40 ГБ | нет |
| Ингест | PostgreSQL | `ingest` | ~50 ГБ | нет |
| Прогресс и история | Cassandra | `engagement` (3 DC) | ~20 ТБ × RF | `profile_id` |
| Рекомендации | Cassandra | `reco` (3 DC) | ~2 ТБ × RF | `profile_id` |
| Эфемерное состояние | Valkey | `state-{cell}` | ~50 ГБ | хеш-слоты |
| Поиск | OpenSearch | `search-{region}` | ~30 ГБ | нет |
| Телеметрия | ClickHouse | `qoe-{region}` | ~300 ТБ (90 дней) | по дате |
| Озеро данных | S3 + Iceberg | `lake` | ~5 ПБ | по дате |

## 3.3. Домен «Идентичность и аккаунты» (PostgreSQL + Citus)

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE account_status AS ENUM ('pending_verification', 'active', 'suspended', 'deleted');

-- Учётная запись: одна на плательщика.
CREATE TABLE accounts (
    account_id          uuid            PRIMARY KEY,               -- UUIDv7
    email_hash          bytea           NOT NULL,                  -- HMAC-SHA256(email) для поиска
    email_encrypted     bytea           NOT NULL,                  -- AES-256-GCM, ключ аккаунта
    password_hash       text,                                      -- argon2id; NULL если только passkey
    status              account_status  NOT NULL DEFAULT 'pending_verification',
    home_region         text            NOT NULL,                  -- us-east-1 | eu-central-1 | ap-southeast-1
    cell_id             smallint        NOT NULL,                  -- ячейка внутри региона
    country_code        char(2)         NOT NULL,                  -- страна регистрации (ISO 3166-1)
    locale              text            NOT NULL DEFAULT 'en-US',
    mfa_enabled         boolean         NOT NULL DEFAULT false,
    email_verified_at   timestamptz,
    data_key_id         uuid            NOT NULL,                  -- ссылка на ключ в Key Service
    created_at          timestamptz     NOT NULL DEFAULT now(),
    updated_at          timestamptz     NOT NULL DEFAULT now(),
    deleted_at          timestamptz
);
-- Уникальность e-mail глобальна: проверяется в глобальном реестре (см. 3.9),
-- здесь уникальность в пределах регионального кластера.
CREATE UNIQUE INDEX ux_accounts_email_hash ON accounts (email_hash);
CREATE INDEX ix_accounts_status ON accounts (status) WHERE status <> 'active';

-- Профили внутри аккаунта (до 5).
CREATE TABLE profiles (
    account_id        uuid        NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    profile_id        uuid        NOT NULL,
    display_name      text        NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 50),
    avatar_id         text        NOT NULL,
    is_kids           boolean     NOT NULL DEFAULT false,
    maturity_level    smallint    NOT NULL DEFAULT 100,           -- 0..100, шкала сопоставляется с рейтингами стран
    ui_language       text        NOT NULL,
    audio_language    text,
    subtitle_language text,
    autoplay_next     boolean     NOT NULL DEFAULT true,
    pin_hash          text,                                        -- PIN профиля (argon2id)
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, profile_id)
);

CREATE TYPE device_platform AS ENUM ('web', 'ios', 'android', 'tvos', 'android_tv', 'tizen', 'webos', 'roku', 'console', 'other');

-- Зарегистрированные устройства.
CREATE TABLE devices (
    account_id          uuid            NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    device_id           uuid            NOT NULL,
    platform            device_platform NOT NULL,
    model               text,
    app_version         text            NOT NULL,
    drm_system          text            NOT NULL,                  -- widevine | fairplay | playready
    drm_security_level  text            NOT NULL,                  -- L1 | L3 | SL3000 | SL2000 | hw
    hdcp_version        text,
    display_name        text,
    registered_at       timestamptz     NOT NULL DEFAULT now(),
    last_seen_at        timestamptz     NOT NULL DEFAULT now(),
    revoked_at          timestamptz,
    PRIMARY KEY (account_id, device_id)
);
CREATE INDEX ix_devices_last_seen ON devices (account_id, last_seen_at DESC) WHERE revoked_at IS NULL;

-- Refresh-токены с ротацией: family_id объединяет цепочку ротаций.
CREATE TABLE refresh_tokens (
    account_id      uuid        NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    token_id        uuid        NOT NULL,
    family_id       uuid        NOT NULL,
    device_id       uuid        NOT NULL,
    token_hash      bytea       NOT NULL,                          -- SHA-256 от токена; сам токен не храним
    parent_token_id uuid,
    issued_at       timestamptz NOT NULL DEFAULT now(),
    expires_at      timestamptz NOT NULL,
    used_at         timestamptz,                                   -- ротация: повторное использование = компрометация
    revoked_at      timestamptz,
    revoke_reason   text,
    ip_encrypted    bytea,
    PRIMARY KEY (account_id, token_id)
);
CREATE UNIQUE INDEX ux_refresh_tokens_hash ON refresh_tokens (account_id, token_hash);
CREATE INDEX ix_refresh_tokens_family ON refresh_tokens (account_id, family_id);
CREATE INDEX ix_refresh_tokens_expiry ON refresh_tokens (expires_at) WHERE revoked_at IS NULL;

-- Passkeys (WebAuthn).
CREATE TABLE webauthn_credentials (
    account_id      uuid        NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    credential_id   bytea       NOT NULL,
    public_key      bytea       NOT NULL,                          -- COSE-ключ
    sign_count      bigint      NOT NULL DEFAULT 0,
    transports      text[]      NOT NULL DEFAULT '{}',
    aaguid          uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    last_used_at    timestamptz,
    PRIMARY KEY (account_id, credential_id)
);

-- Коды device authorization flow (RFC 8628) для ТВ. Живут 10 минут.
CREATE TABLE device_codes (
    device_code_hash bytea       PRIMARY KEY,
    user_code        text        NOT NULL,                         -- 8 символов, без неоднозначных букв
    client_id        text        NOT NULL,
    account_id       uuid,                                         -- заполняется после подтверждения
    status           text        NOT NULL DEFAULT 'pending',       -- pending | approved | denied | expired
    created_at       timestamptz NOT NULL DEFAULT now(),
    expires_at       timestamptz NOT NULL
);
CREATE UNIQUE INDEX ux_device_codes_user_code ON device_codes (user_code) WHERE status = 'pending';

-- Журнал событий безопасности (входы, смены пароля, отзывы токенов).
CREATE TABLE security_events (
    account_id   uuid        NOT NULL,
    event_id     uuid        NOT NULL,
    event_type   text        NOT NULL,
    device_id    uuid,
    ip_encrypted bytea,
    geo_country  char(2),
    risk_score   smallint,
    created_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, event_id)
);
```

Связи домена устроены просто: аккаунт владеет профилями, устройствами, токенами, passkeys и событиями безопасности (отношение 1:N), и все эти таблицы колоцированы с `accounts` по `account_id`. Поэтому любой запрос «всё про аккаунт» выполняется на одном узле Citus без распределённых JOIN. Таблица `device_codes` не распределена по аккаунту, потому что в момент создания кода аккаунт ещё неизвестен: она живёт как локальная таблица на координаторе, а устаревшие записи удаляются периодической задачей.

## 3.4. Домен «Коммерция» (PostgreSQL + Citus)

```sql
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'grace', 'canceled', 'expired');
CREATE TYPE invoice_status     AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');
CREATE TYPE payment_status     AS ENUM ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded');

-- Тарифные планы (reference table, реплицирована на все узлы).
CREATE TABLE plans (
    plan_id             uuid        PRIMARY KEY,
    code                text        NOT NULL UNIQUE,              -- basic_ads | standard | premium
    max_streams         smallint    NOT NULL,
    max_resolution      text        NOT NULL,                      -- 720p | 1080p | 2160p
    hdr_allowed         boolean     NOT NULL,
    spatial_audio       boolean     NOT NULL,
    downloads_devices   smallint    NOT NULL,
    has_ads             boolean     NOT NULL,
    is_active           boolean     NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- Цены по странам с историей (reference table).
CREATE TABLE plan_prices (
    plan_id        uuid        NOT NULL REFERENCES plans(plan_id),
    country_code   char(2)     NOT NULL,
    currency       char(3)     NOT NULL,
    amount_minor   bigint      NOT NULL CHECK (amount_minor >= 0),
    tax_inclusive  boolean     NOT NULL,
    valid_from     timestamptz NOT NULL,
    valid_to       timestamptz,
    PRIMARY KEY (plan_id, country_code, valid_from),
    EXCLUDE USING gist (plan_id WITH =, country_code WITH =,
                        tstzrange(valid_from, valid_to) WITH &&)   -- периоды не пересекаются
);

-- Подписка аккаунта (в каждый момент не более одной активной).
CREATE TABLE subscriptions (
    account_id              uuid                NOT NULL,
    subscription_id         uuid                NOT NULL,
    plan_id                 uuid                NOT NULL REFERENCES plans(plan_id),
    status                  subscription_status NOT NULL,
    currency                char(3)             NOT NULL,
    price_minor             bigint              NOT NULL,          -- зафиксированная цена периода
    current_period_start    timestamptz         NOT NULL,
    current_period_end      timestamptz         NOT NULL,
    trial_end               timestamptz,
    cancel_at_period_end    boolean             NOT NULL DEFAULT false,
    canceled_at             timestamptz,
    pending_plan_id         uuid REFERENCES plans(plan_id),         -- смена тарифа со следующего периода
    provider                text                NOT NULL,          -- card_psp | app_store | google_play | partner
    provider_ref            text,
    version                 integer             NOT NULL DEFAULT 1, -- оптимистическая блокировка
    created_at              timestamptz         NOT NULL DEFAULT now(),
    updated_at              timestamptz         NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, subscription_id)
);
CREATE UNIQUE INDEX ux_subscriptions_one_live ON subscriptions (account_id)
    WHERE status IN ('trialing', 'active', 'past_due', 'grace');
CREATE INDEX ix_subscriptions_renewal ON subscriptions (current_period_end)
    WHERE status IN ('active', 'trialing') AND cancel_at_period_end = false;

-- Платёжные методы: только токены провайдера, PAN никогда не хранится.
CREATE TABLE payment_methods (
    account_id          uuid        NOT NULL,
    payment_method_id   uuid        NOT NULL,
    provider            text        NOT NULL,
    provider_token      text        NOT NULL,
    kind                text        NOT NULL,                      -- card | paypal | sepa | wallet
    brand               text,
    last4               char(4),
    exp_month           smallint,
    exp_year            smallint,
    is_default          boolean     NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, payment_method_id)
);
CREATE UNIQUE INDEX ux_payment_methods_default ON payment_methods (account_id) WHERE is_default;

-- Счета.
CREATE TABLE invoices (
    account_id          uuid           NOT NULL,
    invoice_id          uuid           NOT NULL,
    subscription_id     uuid           NOT NULL,
    number              text           NOT NULL,                   -- человекочитаемый номер
    status              invoice_status NOT NULL,
    currency            char(3)        NOT NULL,
    subtotal_minor      bigint         NOT NULL,
    discount_minor      bigint         NOT NULL DEFAULT 0,
    tax_minor           bigint         NOT NULL DEFAULT 0,
    total_minor         bigint         NOT NULL,
    period_start        timestamptz    NOT NULL,
    period_end          timestamptz    NOT NULL,
    issued_at           timestamptz    NOT NULL DEFAULT now(),
    due_at              timestamptz    NOT NULL,
    paid_at             timestamptz,
    CHECK (total_minor = subtotal_minor - discount_minor + tax_minor),
    PRIMARY KEY (account_id, invoice_id)
);
CREATE INDEX ix_invoices_account_issued ON invoices (account_id, issued_at DESC);
CREATE INDEX ix_invoices_open_due ON invoices (due_at) WHERE status = 'open';

-- Платёжные попытки; idempotency_key защищает от двойного списания.
CREATE TABLE payments (
    account_id          uuid           NOT NULL,
    payment_id          uuid           NOT NULL,
    invoice_id          uuid           NOT NULL,
    payment_method_id   uuid           NOT NULL,
    idempotency_key     text           NOT NULL,
    amount_minor        bigint         NOT NULL,
    currency            char(3)        NOT NULL,
    status              payment_status NOT NULL,
    provider_charge_id  text,
    failure_code        text,
    attempt_no          smallint       NOT NULL DEFAULT 1,
    created_at          timestamptz    NOT NULL DEFAULT now(),
    updated_at          timestamptz    NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, payment_id)
);
CREATE UNIQUE INDEX ux_payments_idem ON payments (account_id, idempotency_key);

-- Входящие вебхуки провайдеров: дедупликация по event_id провайдера.
CREATE TABLE provider_webhooks (
    provider            text        NOT NULL,
    provider_event_id   text        NOT NULL,
    received_at         timestamptz NOT NULL DEFAULT now(),
    processed_at        timestamptz,
    payload             jsonb       NOT NULL,
    PRIMARY KEY (provider, provider_event_id)
);

-- Transactional outbox: событие пишется в той же транзакции, что и изменение.
CREATE TABLE outbox (
    account_id      uuid        NOT NULL,
    event_id        uuid        NOT NULL,
    aggregate_type  text        NOT NULL,                          -- subscription | invoice | payment
    aggregate_id    uuid        NOT NULL,
    event_type      text        NOT NULL,                          -- subscription.activated ...
    payload         jsonb       NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, event_id)
);
```

Частичный уникальный индекс `ux_subscriptions_one_live` на уровне базы гарантирует, что у аккаунта не будет двух живых подписок, даже если из-за гонки два запроса оформления придут одновременно. Ограничение `EXCLUDE` в `plan_prices` исключает пересекающиеся периоды цен. Таблица `outbox` читается Debezium через логическую репликацию, и события попадают в Kafka ровно в том порядке, в каком фиксировались транзакции.

Пример транзакции продления подписки с записью в outbox:

```sql
BEGIN;
UPDATE subscriptions
   SET current_period_start = current_period_end,
       current_period_end   = current_period_end + interval '1 month',
       status               = 'active',
       version              = version + 1,
       updated_at           = now()
 WHERE account_id = $1 AND subscription_id = $2 AND version = $3;   -- оптимистическая блокировка

UPDATE invoices SET status = 'paid', paid_at = now()
 WHERE account_id = $1 AND invoice_id = $4 AND status = 'open';

INSERT INTO outbox (account_id, event_id, aggregate_type, aggregate_id, event_type, payload)
VALUES ($1, $5, 'subscription', $2, 'subscription.renewed',
        jsonb_build_object('plan_id', $6, 'period_end', now() + interval '1 month'));
COMMIT;
```

## 3.5. Домен «Каталог» (PostgreSQL)

```sql
CREATE TYPE title_kind AS ENUM ('movie', 'series', 'special');
CREATE TYPE publish_status AS ENUM ('draft', 'in_review', 'published', 'unpublished');

CREATE TABLE titles (
    title_id            uuid           PRIMARY KEY,
    kind                title_kind     NOT NULL,
    original_title      text           NOT NULL,
    original_language   text           NOT NULL,
    release_year        smallint       NOT NULL,
    runtime_minutes     smallint,                                   -- для фильмов
    production_countries char(2)[]     NOT NULL DEFAULT '{}',
    status              publish_status NOT NULL DEFAULT 'draft',
    popularity_score    real           NOT NULL DEFAULT 0,          -- обновляется ежечасно из аналитики
    created_at          timestamptz    NOT NULL DEFAULT now(),
    updated_at          timestamptz    NOT NULL DEFAULT now()
);
CREATE INDEX ix_titles_status_pop ON titles (status, popularity_score DESC);

CREATE TABLE title_localizations (
    title_id    uuid NOT NULL REFERENCES titles(title_id) ON DELETE CASCADE,
    locale      text NOT NULL,                                      -- BCP 47: ru-RU, en-US, pt-BR
    title       text NOT NULL,
    synopsis    text NOT NULL,
    tagline     text,
    PRIMARY KEY (title_id, locale)
);

CREATE TABLE seasons (
    season_id       uuid     PRIMARY KEY,
    title_id        uuid     NOT NULL REFERENCES titles(title_id) ON DELETE CASCADE,
    season_number   smallint NOT NULL,
    release_year    smallint,
    UNIQUE (title_id, season_number)
);

-- Воспроизводимая единица: фильм или эпизод. Всё, что связано с видео, ссылается сюда.
CREATE TABLE playables (
    playable_id     uuid        PRIMARY KEY,
    title_id        uuid        NOT NULL REFERENCES titles(title_id) ON DELETE CASCADE,
    season_id       uuid        REFERENCES seasons(season_id) ON DELETE CASCADE,
    episode_number  smallint,
    duration_ms     bigint      NOT NULL,
    intro_start_ms  bigint,                                         -- для кнопки «Пропустить заставку»
    intro_end_ms    bigint,
    credits_start_ms bigint,                                        -- для автоперехода к следующему эпизоду
    status          publish_status NOT NULL DEFAULT 'draft',
    CHECK ((season_id IS NULL) = (episode_number IS NULL)),
    UNIQUE (season_id, episode_number)
);
CREATE INDEX ix_playables_title ON playables (title_id);

CREATE TABLE playable_localizations (
    playable_id uuid NOT NULL REFERENCES playables(playable_id) ON DELETE CASCADE,
    locale      text NOT NULL,
    title       text NOT NULL,
    synopsis    text,
    PRIMARY KEY (playable_id, locale)
);

CREATE TABLE genres (
    genre_id    smallint PRIMARY KEY,
    slug        text     NOT NULL UNIQUE
);
CREATE TABLE genre_localizations (
    genre_id    smallint NOT NULL REFERENCES genres(genre_id),
    locale      text     NOT NULL,
    name        text     NOT NULL,
    PRIMARY KEY (genre_id, locale)
);
CREATE TABLE title_genres (
    title_id    uuid     NOT NULL REFERENCES titles(title_id) ON DELETE CASCADE,
    genre_id    smallint NOT NULL REFERENCES genres(genre_id),
    is_primary  boolean  NOT NULL DEFAULT false,
    PRIMARY KEY (title_id, genre_id)
);
CREATE INDEX ix_title_genres_genre ON title_genres (genre_id);

CREATE TABLE people (
    person_id   uuid PRIMARY KEY,
    name        text NOT NULL,
    name_latin  text,
    birth_date  date
);
CREATE TABLE credits (
    title_id    uuid     NOT NULL REFERENCES titles(title_id) ON DELETE CASCADE,
    person_id   uuid     NOT NULL REFERENCES people(person_id),
    role        text     NOT NULL,                                  -- actor | director | writer | producer
    character   text,
    ordering    smallint NOT NULL,
    PRIMARY KEY (title_id, person_id, role)
);
CREATE INDEX ix_credits_person ON credits (person_id);

-- Рейтинги возраста по странам (у каждой страны своя шкала).
CREATE TABLE maturity_ratings (
    title_id        uuid     NOT NULL REFERENCES titles(title_id) ON DELETE CASCADE,
    country_code    char(2)  NOT NULL,
    rating          text     NOT NULL,                              -- 18+, PG-13, FSK 16
    normalized      smallint NOT NULL,                              -- 0..100 для сравнения с профилем
    descriptors     text[]   NOT NULL DEFAULT '{}',
    PRIMARY KEY (title_id, country_code)
);

CREATE TABLE artworks (
    artwork_id      uuid     PRIMARY KEY,
    title_id        uuid     NOT NULL REFERENCES titles(title_id) ON DELETE CASCADE,
    kind            text     NOT NULL,                              -- poster | backdrop | logo | thumbnail
    locale          text,                                           -- NULL = без текста
    width           smallint NOT NULL,
    height          smallint NOT NULL,
    storage_key     text     NOT NULL,
    dominant_color  char(7),
    variant         text                                            -- для A/B-тестов обложек
);
CREATE INDEX ix_artworks_title_kind ON artworks (title_id, kind, locale);

-- Лицензионные окна: где, когда и в каком качестве можно показывать.
CREATE TABLE license_windows (
    license_id      uuid        PRIMARY KEY,
    title_id        uuid        NOT NULL REFERENCES titles(title_id) ON DELETE CASCADE,
    country_code    char(2)     NOT NULL,
    starts_at       timestamptz NOT NULL,
    ends_at         timestamptz,
    max_resolution  text        NOT NULL DEFAULT '2160p',
    offline_allowed boolean     NOT NULL DEFAULT true,
    plan_codes      text[]      NOT NULL DEFAULT '{}',             -- пусто = все тарифы
    contract_ref    text        NOT NULL
);
CREATE INDEX ix_license_country_time ON license_windows (country_code, starts_at, ends_at);
CREATE INDEX ix_license_title ON license_windows (title_id, country_code);
```

## 3.6. Домен «Ингест и видеоассеты» (PostgreSQL)

```sql
CREATE TYPE asset_status AS ENUM ('uploaded', 'qc_failed', 'encoding', 'packaging', 'ready', 'retired');

CREATE TABLE video_assets (
    asset_id         uuid         PRIMARY KEY,
    playable_id      uuid         NOT NULL,                         -- ссылка на каталог (без FK между доменами)
    version          smallint     NOT NULL DEFAULT 1,               -- перезаливки мастера
    source_uri       text         NOT NULL,                         -- s3://masters/...
    source_format    text         NOT NULL,                         -- IMF | ProRes 422 HQ
    source_checksum  text         NOT NULL,                         -- SHA-256
    duration_ms      bigint,
    frame_rate       numeric(6,3),
    hdr_format       text,                                          -- SDR | HDR10 | DolbyVision
    status           asset_status NOT NULL DEFAULT 'uploaded',
    storage_prefix   text,                                          -- s3://origin/{asset_id}/v{version}/
    workflow_id      text,                                          -- ID процесса Temporal
    created_at       timestamptz  NOT NULL DEFAULT now(),
    ready_at         timestamptz,
    UNIQUE (playable_id, version)
);

CREATE TABLE renditions (
    rendition_id     uuid        PRIMARY KEY,
    asset_id         uuid        NOT NULL REFERENCES video_assets(asset_id) ON DELETE CASCADE,
    codec            text        NOT NULL,                          -- avc1 | hvc1 | av01
    width            smallint    NOT NULL,
    height           smallint    NOT NULL,
    bitrate_kbps     integer     NOT NULL,
    vmaf_mean        real,
    hdr_format       text        NOT NULL DEFAULT 'SDR',
    segment_ms       integer     NOT NULL DEFAULT 4000,
    size_bytes       bigint      NOT NULL,
    storage_path     text        NOT NULL,
    min_security     text        NOT NULL DEFAULT 'L3'              -- для 4K требуется аппаратный DRM
);
CREATE INDEX ix_renditions_asset ON renditions (asset_id, codec, bitrate_kbps);

CREATE TABLE audio_tracks (
    track_id     uuid     PRIMARY KEY,
    asset_id     uuid     NOT NULL REFERENCES video_assets(asset_id) ON DELETE CASCADE,
    language     text     NOT NULL,
    kind         text     NOT NULL,                                 -- main | dub | commentary | audio_description
    codec        text     NOT NULL,                                 -- aac | ec-3 | ac-4
    channels     text     NOT NULL,                                 -- 2.0 | 5.1 | atmos
    bitrate_kbps integer  NOT NULL,
    storage_path text     NOT NULL
);

CREATE TABLE subtitle_tracks (
    track_id     uuid     PRIMARY KEY,
    asset_id     uuid     NOT NULL REFERENCES video_assets(asset_id) ON DELETE CASCADE,
    language     text     NOT NULL,
    kind         text     NOT NULL,                                 -- full | forced | sdh
    format       text     NOT NULL DEFAULT 'webvtt',
    storage_path text     NOT NULL
);

-- Ссылки на ключи шифрования; сами ключи — в Key Service (обёрнуты KMS).
CREATE TABLE content_keys (
    key_id        uuid        PRIMARY KEY,                          -- KID из PSSH
    asset_id      uuid        NOT NULL REFERENCES video_assets(asset_id) ON DELETE CASCADE,
    track_class   text        NOT NULL,                             -- sd | hd | uhd | audio
    key_ref       text        NOT NULL,                             -- ссылка в Key Service
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE encoding_jobs (
    job_id        uuid        PRIMARY KEY,
    asset_id      uuid        NOT NULL REFERENCES video_assets(asset_id),
    stage         text        NOT NULL,                             -- qc | analyze | encode | package | publish
    chunk_index   integer,
    status        text        NOT NULL,                             -- queued | running | done | failed
    worker_node   text,
    attempts      smallint    NOT NULL DEFAULT 0,
    error         text,
    started_at    timestamptz,
    finished_at   timestamptz
);
CREATE INDEX ix_encoding_jobs_asset_stage ON encoding_jobs (asset_id, stage, status);
```

Для 4K-рендишенов используются отдельные ключи (`track_class = 'uhd'`) и требуется аппаратный уровень DRM. Даже если скомпрометирован программный CDM на каком-то устройстве, он не получит ключ к 4K-дорожке. Это требование большинства студий в лицензионных договорах.

## 3.7. Домен «Прогресс, история, списки» (Cassandra)

```sql
CREATE KEYSPACE engagement WITH replication = {
  'class': 'NetworkTopologyStrategy', 'us-east-1': 3, 'eu-central-1': 3, 'ap-southeast-1': 3
};

-- Позиция по каждому просмотренному тайтлу (последняя).
CREATE TABLE engagement.viewing_progress (
    profile_id   uuid,
    playable_id  uuid,
    title_id     uuid,
    position_ms  bigint,
    duration_ms  bigint,
    completed    boolean,
    device_id    uuid,
    updated_at   timestamp,
    PRIMARY KEY ((profile_id), playable_id)
);

-- «Продолжить просмотр»: упорядочено по времени, одна строка на тайтл.
-- Обновляется вместе с viewing_progress (logged batch в пределах профиля).
CREATE TABLE engagement.continue_watching (
    profile_id    uuid,
    updated_at    timestamp,
    title_id      uuid,
    playable_id   uuid,
    position_ms   bigint,
    duration_ms   bigint,
    PRIMARY KEY ((profile_id), updated_at, title_id)
) WITH CLUSTERING ORDER BY (updated_at DESC, title_id ASC)
  AND default_time_to_live = 15552000;                             -- 180 дней

-- Полная история: партиция по профилю и месяцу, чтобы партиции не росли бесконечно.
CREATE TABLE engagement.viewing_history (
    profile_id   uuid,
    month        int,                                              -- 202610
    watched_at   timestamp,
    playable_id  uuid,
    title_id     uuid,
    watched_ms   bigint,
    device_type  text,
    country      text,
    PRIMARY KEY ((profile_id, month), watched_at, playable_id)
) WITH CLUSTERING ORDER BY (watched_at DESC, playable_id ASC);

-- «Мой список».
CREATE TABLE engagement.my_list (
    profile_id  uuid,
    added_at    timestamp,
    title_id    uuid,
    PRIMARY KEY ((profile_id), added_at, title_id)
) WITH CLUSTERING ORDER BY (added_at DESC, title_id ASC);

CREATE TABLE engagement.my_list_index (                            -- для проверки «в списке ли тайтл»
    profile_id  uuid,
    title_id    uuid,
    added_at    timestamp,
    PRIMARY KEY ((profile_id), title_id)
);

-- Оценки (лайк/дизлайк/супер-лайк).
CREATE TABLE engagement.ratings (
    profile_id  uuid,
    title_id    uuid,
    rating      tinyint,                                           -- -1, 1, 2
    rated_at    timestamp,
    PRIMARY KEY ((profile_id), title_id)
);

-- Предвычисленные строки рекомендаций (перезаписываются ежечасно).
CREATE TABLE reco.home_rows (
    profile_id   uuid,
    row_rank     smallint,
    row_id       text,                                             -- because_you_watched:{title_id}
    row_title_key text,
    title_ids    list<uuid>,
    model_version text,
    generated_at timestamp,
    PRIMARY KEY ((profile_id), row_rank)
) WITH default_time_to_live = 172800;                              -- 48 часов, затем fallback
```

Каждая таблица Cassandra спроектирована под конкретный запрос: `viewing_progress` отвечает на «где я остановился в этом эпизоде», `continue_watching` — на «что показать в первой строке главной», `viewing_history` — на «покажи историю за месяц». Это классический подход query-first. Партиция истории ограничена месяцем, поэтому даже самый активный профиль создаёт партиции размером в сотни килобайт, а не мегабайты. Для `continue_watching` предыдущая строка тайтла удаляется при обновлении (delete + insert в одном batch по одной партиции), а TTL в 180 дней не даёт накапливаться надгробиям (tombstones).

## 3.8. Эфемерное состояние (Valkey)

| Ключ | Тип | TTL | Назначение |
|------|-----|-----|------------|
| `pb:sess:{session_id}` | HASH | 180 с (продлевается heartbeat) | Сессия воспроизведения: account, profile, playable, device, cdn |
| `cc:{account_id}` | ZSET | 1 час | Активные потоки: member = session_id, score = время последнего heartbeat |
| `ent:{profile}:{playable}:{country}:{devclass}` | STRING | 60 с | Кэш решения Entitlement |
| `cat:title:{title_id}:{locale}` | STRING (protobuf) | 10 мин + jitter | Карточка тайтла |
| `rl:{scope}:{key}:{window}` | STRING (counter) | размер окна | Лимитер запросов (скользящее окно) |
| `idem:{account_id}:{key}` | STRING | 24 часа | Сохранённый ответ идемпотентного запроса |
| `lic:nonce:{nonce}` | STRING | 5 мин | Защита лицензионного запроса от повтора |

## 3.9. Глобальный реестр и маршрутизация

Небольшая глобальная таблица `account_directory` сопоставляет хеш e-mail с `account_id`, домашним регионом и ячейкой. Она нужна при входе, когда регион пользователя ещё неизвестен, и для глобальной уникальности e-mail. Реестр хранится в отдельном кластере Cassandra с `SERIAL`-согласованностью (легковесные транзакции) только для операции регистрации: запись редкая, а чтение идёт с `LOCAL_ONE`.

```sql
CREATE TABLE directory.account_directory (
    email_hash    blob PRIMARY KEY,
    account_id    uuid,
    home_region   text,
    cell_id       smallint,
    created_at    timestamp
);
-- Регистрация: INSERT ... IF NOT EXISTS (Paxos) — гарантирует уникальность e-mail глобально.
```

## 3.10. Аналитические схемы (ClickHouse)

```sql
CREATE TABLE qoe.playback_events
(
    event_date      Date            DEFAULT toDate(ts),
    ts              DateTime64(3, 'UTC'),
    session_id      UUID,
    account_hash    UInt64,                        -- псевдонимизированный идентификатор
    profile_hash    UInt64,
    playable_id     UUID,
    device_type     LowCardinality(String),
    app_version     LowCardinality(String),
    country         LowCardinality(FixedString(2)),
    isp_asn         UInt32,
    cdn             LowCardinality(String),
    edge_pop        LowCardinality(String),
    event_type      LowCardinality(String),        -- start | heartbeat | bitrate_switch | rebuffer | error | stop
    bitrate_kbps    UInt32,
    resolution      LowCardinality(String),
    startup_ms      UInt32,
    rebuffer_ms     UInt32,
    watch_ms        UInt32,
    error_code      LowCardinality(String)
)
ENGINE = ReplicatedMergeTree
PARTITION BY event_date
ORDER BY (event_date, cdn, isp_asn, ts)
TTL event_date + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

CREATE MATERIALIZED VIEW qoe.playback_minute_mv TO qoe.playback_minute AS
SELECT toStartOfMinute(ts) AS ts, cdn, edge_pop, isp_asn, country, device_type,
       countIf(event_type = 'start')      AS starts,
       countIf(event_type = 'error')      AS errors,
       sum(rebuffer_ms)                   AS rebuffer_ms,
       sum(watch_ms)                      AS watch_ms,
       quantileState(0.9)(startup_ms)     AS startup_p90_state
FROM qoe.playback_events
GROUP BY ts, cdn, edge_pop, isp_asn, country, device_type;
```

## 3.11. Сводная диаграмма связей

```
 IDENTITY (Citus, по account_id)         COMMERCE (Citus, по account_id)
 accounts 1--N profiles                  plans 1--N plan_prices
 accounts 1--N devices                   accounts* 1--N subscriptions N--1 plans
 accounts 1--N refresh_tokens            subscriptions 1--N invoices 1--N payments
 accounts 1--N webauthn_credentials      accounts* 1--N payment_methods
 accounts 1--N security_events           outbox (события -> Kafka)
          |  account_id / profile_id (логическая ссылка, не FK)
          v
 ENGAGEMENT (Cassandra, по profile_id)   CATALOG (PostgreSQL)
 viewing_progress, continue_watching,    titles 1--N title_localizations
 viewing_history, my_list, ratings,      titles 1--N seasons 1--N playables
 reco.home_rows  --- title_id/playable_id --> titles, playables
                                         titles N--M genres (title_genres)
 INGEST (PostgreSQL)                     titles N--M people (credits)
 video_assets N--1 playables*            titles 1--N artworks, license_windows,
 video_assets 1--N renditions,                       maturity_ratings
   audio_tracks, subtitle_tracks,
   content_keys, encoding_jobs           (* — логическая ссылка между доменами)
```

## 3.12. Альтернативы и почему не выбраны

1. **Единая общая база данных для всех доменов.** Одна большая PostgreSQL-база с внешними ключами между всеми таблицами упрощает запросы и гарантирует целостность. Но она становится узлом связности: миграция схемы в каталоге блокирует релиз биллинга, тяжёлый аналитический запрос замедляет вход пользователей, а масштабирование упирается в один кластер. Кроме того, профили нагрузки несовместимы: 67 тысяч записей прогресса в секунду не должны конкурировать с транзакциями платежей. Разделение по доменам — стандартная практика для организаций нашего размера.

2. **Хранение прогресса просмотра в PostgreSQL.** PostgreSQL с шардированием справился бы с 67 тысячами записей в секунду на достаточном числе узлов. Однако мультирегиональная запись с разрешением конфликтов в PostgreSQL требует внешних инструментов (логическая репликация с конфликт-хендлерами), которые сложнее Cassandra multi-DC. MVCC PostgreSQL создаёт много «мёртвых» версий строк при частых обновлениях, что требует агрессивной очистки (autovacuum). Cassandra с моделью LSM-дерева и встроенной репликацией между дата-центрами подходит для этой задачи естественнее.

3. **Event sourcing для всех доменов.** Хранение только событий с построением состояния из них даёт полный аудит и возможность перестроить любое представление. Для биллинга мы частично используем эту идею через outbox и неизменяемые платежи. Но полный event sourcing резко усложняет схемы, миграции и запросы «текущего состояния», требует снапшотов и увеличивает порог входа для команд. Для каталога и профилей выгода несоразмерна сложности.

4. **Документная СУБД (MongoDB) для каталога.** Каталог с вложенными локализациями, сезонами и эпизодами выглядит естественным документом, и MongoDB упростила бы чтение карточки целиком. Однако CMS нужны транзакционные изменения, связанные с несколькими тайтлами (например, персона в сотнях титров), и строгие ограничения целостности, где реляционная модель сильнее. Лицензия SSPL также создаёт юридические вопросы. Денормализованный «документ» мы и так получаем в кэше и поисковом индексе, а источник истины остаётся реляционным.

5. **Графовая база данных для рекомендаций и связей «кто с кем снимался».** Графовые БД (Neo4j, JanusGraph) хорошо выражают связи между тайтлами, персонами и пользователями. Но рекомендации в нашей архитектуре строятся офлайн в Spark над озером данных, а онлайн нужны только предвычисленные результаты по ключу профиля, для чего графовая БД избыточна. Запросы вида «фильмы с этим актёром» закрываются индексом `ix_credits_person` в PostgreSQL. Ещё одна технология с отдельной эксплуатацией не окупается.

6. **Хранение ключей DRM прямо в базе ингеста.** Проще было бы держать контентные ключи в таблице `content_keys` рядом с ассетами. Но тогда компрометация одной базы данных (например, утечка резервной копии) раскрывает ключи ко всему каталогу, что недопустимо по договорам со студиями. Отдельный Key Service с обёрткой ключей через HSM-backed KMS гарантирует, что даже полный дамп баз бесполезен без доступа к KMS. Доступ к KMS имеют только лицензионные серверы и конвейер упаковки, и каждый вызов журналируется.
