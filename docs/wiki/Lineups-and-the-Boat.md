# Lineups and the Boat

Open a crew from its event page and you're on the lineup page — three
panels: the **Roster**, the **Boat**, and the **Checks**. On desktop all
three sit side by side; on phones they're tabs.

## Seating people

- **Drag** a paddler from the roster onto a seat. Dropping onto an occupied
  seat is safe: two seated paddlers **swap**; a newcomer displaces the
  occupant to the **reserves** (nobody is ever silently dropped from the
  boat). Dropping onto the drummer or coxswain slot works the same, and a
  remove target takes someone out entirely.
- **Tap to place** (easier one-handed): tap a paddler in the roster, then
  tap the seat — a banner reminds you who's in hand.
- **Keyboard**: pick a paddler up and arrow keys move seat-to-seat; the
  screen-reader announcements name the paddler and the seat.
- Seats run bow (row 1) to stern; each row has a Left and Right seat.
  The zones — **Stroke**, **Engine Room**, **Rockets** — label the front,
  middle, and back of the boat.
- **Pin** a paddler (the pin icon on a seat) and auto-balance will never
  move them — for the stroke pair you've already decided on.
- **Reserves** travel with the crew unseated. Drag people there, or let a
  displacement send them there.

Roster chips carry the paddler's answer for this event: tentative (Maybe)
paddlers are visibly marked on the boat too, and anyone seated in **two
crews of the same category** gets a double-booking flag (reserves don't
clash — being cover for two boats is fine).

## Fill boat

The **Fill boat** button proposes a complete seating in one step — and shows
its reasoning before touching anything:

- **Who**: reserves first, then everyone who said **In**, then **Maybe** —
  never anyone who said Out, and never someone who wasn't asked (once
  sign-ups exist). Active members only; a Women's category takes only
  women; a Mixed category reserves enough seats to meet the
  [minimum-women rule](Settings-and-Club-Rules#crew-rules); nobody already
  seated elsewhere in the category is taken.
- **Where**: side preferences and preferred zones are honoured where
  possible.
- It also fills an empty drummer or coxswain seat from members marked
  able — and says when it couldn't.

The preview lists exactly who lands where and why; applying is **one
undoable step**.

## Auto-balance

The **Balance** panel shows two bars — left/right and bow/stern weight —
green within your club's [tolerances](Settings-and-Club-Rules#balance-tolerances),
amber outside them. Its auto-balance button re-arranges the *currently
seated* paddlers to trim the boat, keeping side preferences and pinned
seats. Undo with one tap (or ⌘Z / Ctrl+Z).

## Undo and redo

Every seating change on this page — a drag, a fill, a balance — goes into
an undo history. The arrows in the header (and ⌘Z / ⌘⇧Z) walk it. History
belongs to this crew and this visit; leaving the page clears it.

## The Checks panel

A live list of everything worth knowing before the boat launches: empty
seats, missing drummer/cox, a Women's crew rule shortfall, side-preference
violations, seated paddlers who haven't signed up, double-bookings,
tentative (Maybe) paddlers, age-division mismatches. Problems are red,
advisories amber; **Race ready** means the list is empty. The same
summary badges appear on the crew's card at the event page.

The crew's **race results** (once times exist) also show here, ranked
against the field.

## The printed crew sheet

**Crew sheet** prints the lineup as a clean sheet — the boat with names in
seats, drummer and cox, reserves, and the balance summary — for the
marshalling area's clipboard. Printing hides all app chrome automatically.

## Alternative plans

If this crew is a plan (a "Plan B"), everything above works the same, with
one difference: the plan counts nowhere and its paddlers stay available to
the real crew. See [Events → Alternative plans](Events-and-Race-Day#alternative-plans-plan-b)
for comparing and swapping.
