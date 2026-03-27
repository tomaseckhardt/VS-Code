# API dokumentace

Base URL: `http://localhost:3000`

Všechny API endpointy vrací JSON. Každá odpověď obsahuje hlavičku `X-Request-Id` pro trasování.

---

## GET /api/reservations

Vrátí všechny rezervace seřazené podle data a času (vzestupně).

**Response 200:**
```json
{
  "reservations": [
    {
      "id": "uuid",
      "name": "Jan Novák",
      "phone": "+420 777 123 456",
      "email": "jan@example.cz",
      "guests": 4,
      "date": "2026-03-28",
      "slot": "19:00",
      "tableId": "window-4",
      "vibe": 7,
      "status": "new",
      "note": "",
      "drink": "MonstRum",
      "createdAt": "2026-03-27T10:00:00.000Z"
    }
  ]
}
```

---

## POST /api/reservations

Vytvoří novou rezervaci.

**Request body:**
```json
{
  "name": "Jan Novák",
  "phone": "+420 777 123 456",
  "email": "jan@example.cz",
  "guests": 4,
  "date": "2026-03-28",
  "slot": "19:00",
  "tableId": "window-4",
  "vibe": 7,
  "drink": "MonstRum",
  "note": "Narozeniny"
}
```

**Povinná pole:** `name`, `phone`, `email`, `guests`, `date`, `slot`, `tableId`, `vibe`

**Validační pravidla:**
| Pole | Pravidlo |
|------|----------|
| `guests` | 1–100, integer, nesmí překročit kapacitu stolu |
| `vibe` | 1–11, integer |
| `date` | Formát `YYYY-MM-DD` |
| `slot` | Formát `HH:00` |
| `tableId` | Musí odpovídat existujícímu stolu |
| `email` | Regex validace |
| `phone` | Regex: začíná `+` nebo číslicí, min 8 znaků |

**Response 201:** `{ "reservation": { ... } }`
**Response 400:** `{ "error": "Chybí povinné pole: name" }`
**Response 409:** `{ "error": "Tenhle stůl je v daném čase už rezervovaný." }`

---

## PATCH /api/reservations/:id

Aktualizuje status nebo poznámku existující rezervace.

**Request body (alespoň jedno pole):**
```json
{
  "status": "confirmed",
  "note": "Volali jsme, potvrzeno"
}
```

**Povolené stavy:** `new` → `called` → `confirmed` → `done` → `completed`

**Response 200:** `{ "reservation": { ... } }`
**Response 400:** `{ "error": "Neplatný stav rezervace." }`
**Response 404:** `{ "error": "Rezervace nebyla nalezena." }`

---

## DELETE /api/reservations/:id

Smaže rezervaci podle ID.

**Response 200:** `{ "ok": true }`
**Response 400:** `{ "error": "Neplatné ID." }`
**Response 404:** `{ "error": "Rezervace nebyla nalezena." }`

---

## Dostupné stoly

| ID | Kapacita | Popis |
|----|----------|-------|
| `bar-2` | 2 | Barový pult |
| `window-4` | 4 | U okna |
| `lounge-4` | 4 | Lounge zóna |
| `booth-6` | 6 | Polouzavřený box |
| `vip-8` | 8 | Zadní salonek |

---

## Bezpečnostní hlavičky

Každá odpověď obsahuje:
- `Content-Security-Policy` — omezuje zdroje na `'self'` + Google Fonts
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Cross-Origin-Opener-Policy: same-origin`
- `Permissions-Policy` — zakazuje geolokaci, mikrofon, kameru

CORS origin je omezen na adresy v `ALLOWED_ORIGINS` (env proměnná).

---

## Background job: Auto-kompletace

Každých 5 minut server projde všechny rezervace. Pokud od začátku slotu uplynula 1 hodina, automaticky nastaví status na `completed`.
