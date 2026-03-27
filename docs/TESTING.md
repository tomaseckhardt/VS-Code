# Průvodce testováním

## Spuštění testů

```bash
npm run test:e2e                    # Všechny testy
npx playwright test --config=tests/playwright.config.js tests/basic-functionality.spec.js  # Konkrétní soubor
```

Server se spouští automaticky (config `webServer` v `tests/playwright.config.js`).

## Konfigurace

| Parametr | Hodnota |
|----------|---------|
| Prohlížeč | Chromium (headless) |
| Base URL | `http://127.0.0.1:3000` |
| Timeout akce | 30 s |
| Timeout expect | 10 s |
| Timeout testu | 60–90 s (nastaveno per-test) |
| Výstup | `tests/test-results/` |

## Přehled testů

### basic-functionality.spec.js

| Test | Co ověřuje |
|------|-----------|
| `zakladni funkcnost bez potvrzeni rezervace` | Navigace, filtrování menu, výběr data/času/stolu, vibe slider, souhrn, admin přepnutí na karty |
| `drink modal je ovladatelny klavesnici i mysi` | Otevření klikem, Escape, Enter, Space, backdrop click, X button |

### full-booking-admin.spec.js

| Test | Co ověřuje |
|------|-----------|
| `kompletni booking flow se zobrazenim v adminu` | Celý flow: vyplnění formuláře → odeslání → ověření v adminu → smazání |

### admin-quick-actions.spec.js

| Test | Co ověřuje |
|------|-----------|
| `admin quick actions meni stav rezervace` | Vytvoření rezervace → admin hledání → akce confirm → done → delete |

### api-reservation-status.spec.js

| Test | Co ověřuje |
|------|-----------|
| `API PATCH meni status rezervace` | POST nové → PATCH status na confirmed → GET kontrola → neplatný status 400 → DELETE |

## Jak psát nové testy

### Vzor testu

```javascript
const { test, expect } = require('@playwright/test');

test('popis co test ověřuje', async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto('/');

  // Čekej na konkrétní stav UI, ne na čas
  await expect(page.locator('#nejakyElement')).toBeVisible();

  // Interakce
  await page.locator('#input').fill('hodnota');
  await page.getByRole('button', { name: 'Odeslat' }).click();

  // Ověření výsledku
  await expect(page.locator('#status')).toContainText('Úspěch');
});
```

### Pravidla

1. **Žádné waitForTimeout** — vždy čekej na konkrétní stav UI (`toBeVisible`, `toContainText`, `toHaveClass`)
2. **Unikátní data** — používej `Date.now()` v jméně/emailu, aby se testy nerušily
3. **Úklid** — pokud test vytvoří rezervaci, na konci ji smaž (DELETE přes API nebo UI)
4. **Timeout** — nastav `test.setTimeout()` na dostatečnou hodnotu (typicky 90 s)

### Klíčové selektory

| Co hledáš | Selektor |
|-----------|----------|
| Slot button (volný) | `#slotGrid .slot-btn:not(.is-disabled)` |
| Stůl (volný) | `#tableGrid .table-option:not(.is-disabled)` |
| Submit tlačítko | `button[type="submit"]` nebo `getByRole('button', { name: 'Potvrdit rezervaci' })` |
| Status zpráva | `#reservationStatus` |
| Admin řádek | `#reservationRows tr` |
| Admin status | `#status` (aria-live region) |
| Drink modal | `#drinkModal` (třída `is-open` když otevřený) |
| Vibe warning | `#vibeWarning` |

### Spuštění s vizuálním debug

```bash
npx playwright test --config=tests/playwright.config.js --headed    # S oknem prohlížeče
npx playwright test --config=tests/playwright.config.js --debug     # Step-by-step debug
npx playwright show-trace tests/test-results/trace.zip              # Trace Viewer
```
