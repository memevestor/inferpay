# ARCHIVED — 2026-05-20

Проект архивирован. Сервер `ipayx402.xyz` (Contabo VPS `157.173.110.229`) выводится из эксплуатации.

## Что было

Pay-per-Inference Hub — хакатон-проект (Circle x402 / Nanopayments). Demo доступен по `ipayx402.xyz` до момента decommission VPS.

## Что осталось после архивации

- **Код** — этот репозиторий, ветка `main`, tag `archive/2026-05-20`.
- **Финальный state БД** (`data/inferpay.db`, 146 testnet-транзакций) — закоммичен.
- **Снапшот сервера** (полная директория, сертификат, env) — локально в `~/Documents/Archives/pay-per-inference-hub-2026-05-20/`, см. README там же.

## Что снесено

- VPS `vmi3146521 / 157.173.110.229` — cancel в Contabo UI.
- Домен `ipayx402.xyz` — отпускается, не используется.
- `OPENROUTER_API_KEY` — поставлен лимит на стороне OpenRouter.
- Остальные ключи в `.env.local` — testnet, реальных средств нет.

## Если когда-нибудь нужно поднять обратно

См. `~/Documents/Archives/pay-per-inference-hub-2026-05-20/README.md` § How to restore.
