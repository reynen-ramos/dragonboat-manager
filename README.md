# Dragonboat Manager

Club roster, race events, and visual crew seating for dragon boat teams.

Spreadsheets can hold a roster, but they cannot express the thing that actually
matters: **where each paddler physically sits in the boat**, and whether that
seating is legal and balanced. That is what this is for.

## What it does

- **Club members** — paddler registry with weight, paddling side, drummer/cox
  ability, contact and emergency details. CSV import (matched loosely against
  whatever your existing spreadsheet calls its columns) and export.
- **Events → categories → crews** — a category is a boat size crossed with a
  class (`20s Mixed`, `10s Women's`), optionally narrowed by age division and
  race distance. Each category holds as many crews as you need, and a crew can
  be duplicated with its whole lineup.
- **The boat** — drag paddlers onto seats. Dropping onto an occupied seat swaps
  the two; dragging out to the roster removes them; anyone displaced lands in
  the reserves rather than disappearing. Works with a mouse, with touch, and
  from the keyboard. Undo and redo with `⌘Z` / `⌘⇧Z`.
- **Weight and side balance** — live left/right and bow/stern figures, and a
  `Balance sides` button that redistributes the paddlers who can sit either
  side. Pin a seat to hold someone in place.
- **Crew checks** — seat counts, drummer and cox, women's and mixed-crew
  composition, paddlers double-booked within a category, unavailable paddlers,
  age divisions.

## Running it

```bash
npm install
npm run dev
```

The app opens with an empty club. Press **Load demo club** on the dashboard for
~35 paddlers and a part-filled crew, or import `sample-data/members.csv`.

```bash
npm run build    # typecheck + production build
npm test         # unit tests
npm run lint
```

## How it is put together

Three layers that do not leak into each other:

| Layer | Where | Depends on |
|---|---|---|
| Domain | `src/domain` | nothing — no React, no storage, no browser APIs |
| Storage | `src/data` | domain |
| UI | `src/components`, `src/pages` | `src/queries` only |

`src/domain` holds the boat geometry, the balance arithmetic, the crew rules,
and the drag-and-drop seating logic as pure functions. It is where the tests
are, and it is what would port unchanged to a native client.

`src/data` defines repository interfaces and implements them. Today that is a
localStorage adapter; adding Supabase means writing a second adapter and
setting one environment variable, with no change to any screen.

Rules that vary between federations — chiefly the minimum number of women in a
mixed crew — are settings in `src/domain/rules.config.ts`, never constants
inside a validator.

## Data and privacy

Everything lives in your browser's local storage. Nothing is uploaded and
there is no account. **Clearing your browser data deletes it**, so use
*Settings → Export backup* regularly.

The roster holds dates of birth and emergency contacts. Treat an exported
backup with the same care as the spreadsheet it replaces.

## Not built yet

Sign-in and a shared database, paddler self-service availability, race day
results, lineup versioning, and printable crew sheets.
