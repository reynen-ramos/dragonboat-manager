# Dragonboat Manager

Club roster, race events, and visual crew seating for dragon boat teams.

Spreadsheets can hold a roster, but they cannot express the thing that actually
matters: **where each paddler physically sits in the boat**, and whether that
seating is legal and balanced. That is what this is for.

## What it does

- **Club members** — paddler registry with weight, paddling side, preferred
  seating zones, drummer/cox ability, contact and emergency details. CSV import
  (matched loosely against whatever your existing spreadsheet calls its
  columns) and export. Each member page tells their story backwards: past
  races and practices crewed, sign-up record, and the seat they usually hold.
- **Events → categories → crews** — a category is a boat size crossed with a
  class (`20s Mixed`, `10s Women's`), optionally narrowed by age division and
  race distance. Each category holds as many crews as you need, and a crew can
  be duplicated with its whole lineup.
- **Event types are yours** — race, practice, and other are just the seeded
  defaults. Rename them, delete them, or add your own (a time trial, a team
  building day) in Settings; each type declares whether it behaves like a
  race, a training, or neither, and that drives everything downstream.
  Training sessions carry a kind — water, land, supplementary, or whatever
  list you maintain.
- **Events and Trainings, separately** — races and one-offs live under
  Events; the training schedule has its own section, read the way a coach
  plans: this week, next week, and the season behind folded by month, each
  session one tap from its sign-up sheet. Both offer the same month-grid
  calendar showing the whole club week, colour-coded by behaviour, where a
  two-day regatta occupies both squares and tapping a day creates an event
  already dated. The dashboard splits what's ahead the same way.
- **Sign-ups** — each event has a sign-up sheet (In / Maybe / Out, with
  notes). The lineup builder's paddler pool is **opt-in**: only members who
  signed up appear, Maybe flagged as tentative, with a "Show everyone" escape
  hatch for the walk-up — and a warning if someone unsigned ends up seated.
- **The boat** — drag paddlers onto seats. Dropping onto an occupied seat swaps
  the two; dragging out to the roster removes them; anyone displaced lands in
  the reserves rather than disappearing. Works with a mouse, with touch, and
  from the keyboard. Undo and redo with `⌘Z` / `⌘⇧Z`.
- **Fill the boat** — one tap proposes a full lineup: the crew's reserves
  first, then paddlers signed up In, then Maybe — never anyone marked Out or
  unsigned — previewed by name before anything is applied.
- **Weight and side balance** — live left/right and bow/stern figures, and a
  `Balance sides` button that redistributes the paddlers who can sit either
  side. Pin a seat to hold someone in place.
- **Crew checks** — seat counts, drummer and cox, women's and mixed-crew
  composition, paddlers double-booked within a category, sign-up status,
  age divisions.
- **Plan B lineups** — any crew can hold alternative lineups, compared
  side-by-side and swapped in whole. Variants never race, never double-book,
  and never block a fill.
- **Race day** — heats, semis, and finals with lanes. Type finish times and
  placements and gaps to the winner are derived from them, so fixing a
  mistyped time re-orders the race for free. Advancing crews between stages
  is one reviewed step.
- **Crew sheet** — a one-page printable seating chart for the team tent.
- **Safety nets** — every delete is undoable (cascades restore whole), and
  the dashboard nudges for a backup export when one is overdue.

## Running it

```bash
npm install
npm run dev
```

The app opens with an empty club. Press **Load demo club** on the dashboard for
a full season anchored to today — 80 paddlers spanning junior to Senior C, a
training calendar running since New Year (water every Saturday and Sunday,
land every Tuesday and Thursday, with sign-ups and boat lineups to report
on), a finished regatta with results, a race running today with heats waiting
to be advanced, a part-planned championship with a Plan B lineup to compare,
and a qualifier on the horizon. Or import `sample-data/members.csv` and start
from your own roster.

```bash
npm run build    # typecheck + production build
npm test         # unit tests
npm run lint
node scripts/make-icons.mjs   # regenerate the app icons from their SVG source
```

## How it is put together

Three layers that do not leak into each other:

| Layer | Where | Depends on |
|---|---|---|
| Domain | `src/domain` | nothing — no React, no storage, no browser APIs |
| Storage | `src/data` | domain |
| UI | `src/components`, `src/pages` | `src/queries` only |

`src/domain` holds the boat geometry, the balance arithmetic, the crew rules,
the fill and seating logic, and the calendar as pure functions. It is where
most of the tests are, and it is what would port unchanged to a native client.

`src/data` defines repository interfaces and implements them. Today that is a
localStorage adapter; adding Supabase means writing a second adapter and
setting one environment variable, with no change to any screen.

Rules that vary between clubs and federations — the minimum number of women
in a mixed crew, balance tolerances, the event types and training kinds
themselves — are settings, never constants inside a validator.

## Data and privacy

Everything lives in your browser's local storage. Nothing is uploaded and
there is no account. **Clearing your browser data deletes it**, so use
*Settings → Export backup* regularly.

The roster holds dates of birth and emergency contacts. Treat an exported
backup with the same care as the spreadsheet it replaces.

## Not built yet

Sign-in and a shared database (Supabase, with admin/coach/paddler roles), so
lineups sync across devices and paddlers record their own sign-ups — today a
coach records them on everyone's behalf. Also lineup version history,
fitness/erg test data, and offline editing — the app reads offline but needs
a live page to write.
