# Events and Race Day

The **Events** page lists races and one-off club events (trainings have
[their own section](Trainings)): upcoming first, the past grouped by month.
The **Calendar** view shows the whole club month. Event types are
club-defined — see [Settings](Settings-and-Club-Rules#event-types) — and each
type *behaves like* a race, a practice, or neither:

- **Race-like** types get Race day, results, and count as races in history
  and reports.
- **Practice-like** types get training kinds and live under Trainings.
- **Other** (a fundraiser, an AGM) appears on the calendar and dashboard
  and takes sign-ups, but counts in no paddling statistics.

## Creating an event

**New event** (or tap a calendar day): name, type, start date, an optional
end date for a weekend regatta, location, notes.

## Inside an event

The event page is the regatta's control room:

- The **sign-ups band** at the top shows In / Maybe / Out counts at a
  glance and opens the [sign-up sheet](Sign-ups).
- **Add category** for each class you're entering — boat size (10 or 20),
  gender class (**Open / Mixed / Women's**), and optionally an age division
  and distance. Categories are how the app knows which rules to check and
  who races whom.
- Each category holds its **crews**. *Add crew* names them A Crew, B Crew…
  automatically. A crew card shows seats filled, drummer/cox, reserves, and
  a readiness badge — **Race ready**, or the count of warnings/problems —
  and opens the [lineup](Lineups-and-the-Boat).
- The **crew menu** (⋮): *Duplicate with its lineup* (start the B crew from
  the A crew), *Add an alternative plan* (a Plan B variant — see below),
  and for plans: compare against the main lineup, or *Use this lineup* to
  swap it in.

### Alternative plans (Plan B)

A plan is a full copy of a crew's lineup, marked as a draft. Plans never
race, never trigger double-booking warnings, and count in no report — their
paddlers stay fully available to real crews. Compare a plan side-by-side
with the main lineup (the diff shows exactly who moves where), and when the
plan wins, swap it in: the racing crew keeps its identity (results stay
attached), the lineups exchange, and running the swap again is the undo.

## Race day

For race-like events, the **Race day** button opens the results page — built
to be used at a finish line:

1. **Enter a race.** Per category, tap **Heat**, **Semi-final**, or
   **Final**: every crew in the category is entered at once, lanes numbered
   in order. Add a second heat the same way. (You can go straight to a
   final — plenty of regattas run no semis.)
2. **Type times as boats finish.** Each row has a time box — type `2:05.42`
   (or just seconds, e.g. `125.42`) and it commits when you leave the box.
   Rows hold **lane order** and never jump while you type; the placement
   badge (gold for 1st) carries the result. Clearing a box removes the
   time; an unreadable entry turns the box red and stores nothing.
3. **Placements are derived, never stored.** Fix a mistyped time and the
   whole heat reorders itself. Ties share a placement (two crews on the
   same time are both 1st; the next is 3rd), and untimed crews sit last,
   unplaced, with the gap-to-winner shown for everyone else.
4. **Advance the fastest crews.** Once a stage has times, *Advance from
   heats* proposes the next stage: ranked by **best time across all races
   of the stage** (the dragon boat convention — lanes and draws vary too
   much for place-per-heat), a tie exactly at the cut takes both crews,
   and multiple finals/semis are seeded snake-style so they're of equal
   strength. Preview who advances — and who's left out for having no
   time — before confirming.

Results also appear on each crew's lineup page, on every member's
[personal results](Members-and-Roster#the-member-page), and in the
[Results report](Reports#results).

## Deleting

Deleting an event takes its categories, crews, lineups, race times, and
sign-ups with it — one confirm, and then an **Undo** toast that restores
every last row if you regret it. The same applies to deleting a category or
a crew.
