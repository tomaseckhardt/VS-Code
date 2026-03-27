# BarX — Craft Cocktail Bar Praha

Rezervační systém s veřejným webem a admin dashboardem. Jednoduchý Node.js server bez externích závislostí, data v JSON souboru.

## Rychlý start

```bash
npm start              # Spustí server na http://localhost:3000
npm run test:e2e       # Spustí Playwright E2E testy
```

## Struktura projektu

```
├── index.html          Veřejný web (menu, rezervace, kontakt)
├── admin.html          Admin dashboard (přehled rezervací)
├── styles.css          Sdílené styly pro obě stránky
├── server.js           Node.js HTTP server + REST API
├── reservations.json   Datový soubor (generuje se automaticky)
├── package.json        Skripty a závislosti
├── tests/              Playwright E2E testy
│   ├── playwright.config.js
│   ├── basic-functionality.spec.js
│   ├── full-booking-admin.spec.js
│   ├── admin-quick-actions.spec.js
│   └── api-reservation-status.spec.js
└── docs/
    ├── API.md          REST API dokumentace
    ├── ARCHITECTURE.md Architektura a klíčové komponenty
    └── TESTING.md      Průvodce testováním
```

## Hlavní funkce

| Stránka | Co dělá |
|---------|---------|
| **index.html** | Drink menu s filtry a modály, rezervační formulář s live souhrnem, vibe systém se slevami |
| **admin.html** | Tabulkový/kartový přehled rezervací, filtrování, řazení, rychlé akce (volat → potvrdit → hotovo → smazat) |
| **server.js** | REST API, statický file server, auto-kompletace starých rezervací (background job 5 min) |

## Konfigurace

| Proměnná prostředí | Default | Popis |
|---------------------|---------|-------|
| `PORT` | `3000` | Port serveru |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Povolené CORS originy (čárkou oddělené) |

## Další dokumentace

- [docs/API.md](docs/API.md) — Endpointy, payloady, chybové kódy
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Komponenty, DOM IDs, JS funkce, datový model
- [docs/TESTING.md](docs/TESTING.md) — Jak spustit testy, co pokrývají, jak psát nové
