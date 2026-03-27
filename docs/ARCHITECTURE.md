# Architektura projektu

## Přehled komponent

```
┌─────────────┐     HTTP      ┌─────────────┐     JSON fs     ┌──────────────────┐
│  index.html │ ◄──────────► │  server.js  │ ◄────────────► │ reservations.json │
│  admin.html │   fetch API   │  (Node.js)  │   read/write    │   (persistence)  │
│  styles.css │               │             │                 │                    │
└─────────────┘               └─────────────┘                 └──────────────────┘
                                    │
                                    │ background job (5 min)
                                    ▼
                              auto-kompletace
                              starých rezervací
```

---

## server.js — Backend

### Základní flow requestu

1. HTTP request dorazí do `http.createServer` handleru
2. Přiřadí se `X-Request-Id` (UUID) a startuje se měření latence
3. Podle URL se routuje na `handleApi()` nebo `handleStatic()`
4. Po dokončení se zaloguje structured JSON (`[HTTP]` prefix)

### Klíčové funkce

| Funkce | Vstup | Výstup | Popis |
|--------|-------|--------|-------|
| `sendJson(req, res, code, data)` | request, status, payload | HTTP JSON response | Přidává CORS + security headers |
| `sendText(req, res, code, msg)` | request, status, text | HTTP text response | Pro statiku/errory |
| `readReservations()` | — | `Array<Reservation>` | Čte z JSON souboru |
| `writeReservations(items)` | pole rezervací | — | Atomický zápis (temp → rename) |
| `validateReservation(payload)` | raw POST data | `null` nebo error string | Ověří povinná pole + formáty |
| `normalizeReservation(payload)` | validní data | `Reservation` objekt | Přidá UUID, timestamp, default status |
| `getSecurityHeaders()` | — | objekt hlaviček | CSP, X-Frame-Options atd. |
| `getCorsHeaders(req)` | request | objekt hlaviček | Dynamický origin dle ALLOWED_ORIGINS |
| `logRequest(...)` | req metadata | console.log | Structured JSON log |

### Datový model rezervace

```typescript
interface Reservation {
  id: string;            // UUID v4
  name: string;
  phone: string;
  email: string;
  guests: number;        // 1–100
  date: string;          // YYYY-MM-DD
  slot: string;          // HH:00
  tableId: string;       // bar-2 | window-4 | lounge-4 | booth-6 | vip-8
  vibe: number;          // 1–11
  status: string;        // new | called | confirmed | done | completed
  note: string;
  drink: string;
  createdAt: string;     // ISO 8601
  updatedAt?: string;    // ISO 8601 (po PATCH)
}
```

---

## index.html — Veřejný web

### Sekce stránky

| Sekce | ID / selektor | Účel |
|-------|---------------|------|
| Navigace | `nav` | Fixed top, logo + links |
| Hero | `.hero`, `#hero-canvas` | Animovaný canvas s orbami |
| Menu | `#menu` | Filtrovatelné karty drinků |
| O nás | `#about` | Text + statistiky |
| Rezervace | `#reservation` | Formulář + souhrn + uložené |
| Kontakt | `#contact` | Adresa, hodiny, telefon, email |
| Drink Modal | `#drinkModal` | Detail drinku (klávesnice + myš) |

### Klíčové DOM IDs — Formulář

| ID | Typ | Účel |
|----|-----|------|
| `#guestName` | text input | Jméno hosta |
| `#guestPhone` | tel input | Telefon |
| `#guestEmail` | email input | E-mail |
| `#guestCount` | select | Počet hostů (2–8) |
| `#reservationDrink` | select | Výběr drinku (9 položek) |
| `#reservationDate` | date input | Datum (min = zítra) |
| `#plannedVibe` | range 1–11 | Vibe slider |
| `#reservationNote` | textarea | Poznámka |
| `#slotGrid` | div | Dynamicky generované časové sloty |
| `#tableGrid` | div | Dynamicky generované stoly |
| `#reservationStatus` | div | Stavová zpráva (úspěch/chyba) |

### Klíčové DOM IDs — Souhrn

| ID | Popis |
|----|-------|
| `#summaryDate`, `#summaryTime`, `#summaryTable` | Výběr uživatele |
| `#summaryDrink`, `#summaryVibe`, `#summaryGuests` | Parametry večera |
| `#summaryEstimateBase`, `#summaryEstimateDiscount`, `#summaryEstimateTotal` | Cenový odhad |
| `#reservationAvailability` | Volné stoly dnes večer |

### Vibe systém

| Pravidlo | Efekt |
|----------|-------|
| Vibe 1–8 | Žádná sleva |
| Vibe 9–10 | 10% sleva, zobrazí se `#vibeWarning` |
| Vibe 11 (legendary) | 100% sleva, speciální animace |

Cenový odhad: `BASE_SPEND_PER_GUEST (520 Kč) × hosté × (1 + (vibe - 5) × 0.08)`

### Klíčové JS funkce

| Funkce | Popis |
|--------|-------|
| `openDrinkModal(card)` | Extrahuje data z karty → naplní modal |
| `closeDrinkModal()` | Zavře modal, vrátí focus |
| `setMinDate()` | Nastaví min datum na zítra |
| `renderSlots()` | Generuje časové sloty dle data a otevírací doby |
| `renderTables()` | Generuje stoly dle hostů a obsazenosti |
| `renderSavedReservations()` | Zobrazí uložené rezervace v sidebaru |
| `updateSummary()` | Přepočítá souhrn + cenový odhad |
| `updateVibeUI()` | Přepíná badge, warning, legendary efekty |
| `updateAvailabilityHint()` | Počet volných stolů dnes |
| `validateReservationForm(...)` | Validuje form, scrolluje na chybu |
| `refreshReservationUI()` | Orchestrátor: sloty + stoly + souhrn + stav |

### Otevírací doba (generování slotů)

| Den | Hodiny |
|-----|--------|
| Po–Čt | 17:00–01:00 |
| Pá–So | 17:00–03:00 |
| Ne | 18:00–00:00 |

---

## admin.html — Admin dashboard

### Klíčové DOM IDs

| ID | Typ | Účel |
|----|-----|------|
| `#searchInput` | search input | Live hledání (jméno, drink, telefon, stůl) |
| `#statusFilter` | select | Filtr podle stavu |
| `#sortBy` | select | 8 režimů řazení |
| `#tabTable`, `#tabCards` | buttons | Přepínání pohledů |
| `#reservationRows` | tbody | Data v tabulce |
| `#reservationCards` | div | Data v kartách |
| `#statTotal`, `#statToday`, `#statDrink`, `#statGuests` | strong | Statistiky |

### Rychlé akce v řádcích

| data-action | Efekt | Nový status |
|-------------|-------|-------------|
| `call` | Označí jako provolané | `called` |
| `confirm` | Potvrdí rezervaci | `confirmed` |
| `done` | Označí jako v pořádku | `done` |
| `delete` | Smaže rezervaci | — |

### Auto-refresh

Každých 30 sekund volá `GET /api/reservations` a překresluje oba pohledy.

---

## styles.css — Sdílená pravidla

| Blok | Řádky (přibližně) | Popis |
|------|-----|-------|
| Reset + proměnné | 1–25 | CSS vars (`--bg`, `--accent1`, ...) |
| Navigace | ~130–200 | Fixed nav, logo, links |
| Hero | ~200–320 | Canvas, orby, animace |
| Menu + karty | ~380–550 | Grid, filtry, drink-card themes |
| Drink Modal | ~470–650 | Full-screen dialog, visual efekty |
| Rezervace | ~800–1250 | Formulář, sloty, stoly, souhrn, vibe |
| Kontakt + footer | ~1420–1460 | Grid karet |
| Admin page | ~1700–2360 | `.admin-page` namespace |
| Responsive | @media 600, 380, 980, 900, 760, 560 | Breakpointy |
| Animace | keyframes | fadeUp, gradientShift, orbPulse, ... |
