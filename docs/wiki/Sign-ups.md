# Sign-ups

Every event and training has a **sign-up sheet**: one row per active member,
each answering **In**, **Maybe**, or **Out**. Counts sit at the top; rows
carry the member's gender and side marks, weight and age, and an optional
note ("Travelling for work", "Shoulder rehab") — tap an answered row's note
line to edit it. Search, gender/side filters, and sorting make an 80-member
sheet workable.

Reach a sheet from the event page's sign-ups band, the **Sign-ups** button
on any training row, or the event's header.

## How answers are used

Sign-ups are the app's honest layer between "we asked" and "they raced":

- **The lineup roster is opt-in.** When at least one person has answered,
  the [lineup page](Lineups-and-the-Boat) offers only those who said In or
  Maybe (a *Show everyone* switch overrides for the day someone forgets to
  sign up). **Fill boat** never seats anyone who said Out or wasn't asked.
- **The checks panel warns** when a seated paddler hasn't signed up —
  once anyone has answered for that event.
- **Reports count them**: Attendance tallies In/Maybe/Out/unanswered per
  member; the [Bench report](Reports#bench) finds people who said In but
  never got a seat.
- **Maybe is visible everywhere** — a tentative paddler is marked as
  tentative on the boat, not silently treated as certain.

## Bulk answers

For staff, the sheet offers *"Mark the N paddlers who haven't signed up yet
as In / Maybe / Out"* — it only ever touches the **unanswered**, never
overwriting a real reply. Useful when the club's habit is "assume In unless
told otherwise".

## Paddlers answering for themselves

With [club sign-in](Accounts-and-Roles) set up, paddlers answer their own
sign-ups from [My Page](My-Page-for-Paddlers) — and on a coach's sheet,
their answers appear live, within a second, no refresh. On the sheet
itself a signed-in paddler sees everyone's status but can change only
**their own row** (the database enforces this, not just the screen).

Without sign-in, a coach records answers on everyone's behalf — the sheet
is built for exactly that, one thumb, top to bottom.

## Notes

- A note belongs to an answer — a row that hasn't answered can't hold one
  (the app would otherwise have to invent an answer to store it).
- Answers have no deadline mechanics: the sheet is live until the event is
  deleted, and changing an answer just replaces it.
