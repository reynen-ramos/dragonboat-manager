# Settings and Club Rules

**Settings** holds everything that varies between clubs and governing
bodies. With [sign-in](Accounts-and-Roles) enabled it's an admin page; the
data tools also live here (see [Backups and Your Data](Backups-and-Your-Data)).

## Crew rules

**Minimum women in a mixed crew**, per boat size (default 4 in a 10s, 8 in
a 20s). Federations differ — set what your regatta enforces. The
[checks panel](Lineups-and-the-Boat#the-checks-panel) and
[Fill boat](Lineups-and-the-Boat#fill-boat) both honour it.

## Balance tolerances

How far weight may differ before the boat's balance bars warn, as a
percentage of total crew weight — **left/right** (default 3%) and
**bow/stern** (default 5%). Looser numbers quiet the bars; tighter ones
make auto-balance work harder.

## Event types

The types an event can be — seeded with *Race / regatta*, *Practice*, and
*Other*, and fully yours to change: rename any (including the seeded ones),
add your own, delete what you don't use. What matters is each type's
**"behaves like"** setting, because behaviour is what the app branches on:

- **Race** — gets Race day and results; counts as a race in history and
  reports.
- **Training** — gets training kinds; lives in the Trainings section.
- **Other** — calendar and sign-ups only; counts in no paddling statistics.

So a "Time trial regatta" type that behaves like a race, or a "Team
building" type that behaves like other, is a ten-second addition. Renaming
a type renames it on every event at once — events remember the type, not
the wording. The only guardrails: a type in use can't be deleted (its
events would be orphaned), and neither can the last one.

## Training kinds

The kinds a training session can be — seeded *Water training*, *Land
training*, *Supplementary training*; rename, add ("Erg intervals",
"Paddle-fit"), or delete unused ones. Kinds are labels that follow the
session onto the dashboard, lists, and sign-up rows.

## Time-trial disciplines

The craft or machine a [time trial](Time-Trials) is run on — seeded *OC1*,
*Erg*, *Small boat*. Same freedoms and guardrails as training kinds.
Disciplines separate the best-times boards: a 200m OC1 time never competes
with a 200m erg score.

## Access

Admin-only, and only meaningful in [club mode](Accounts-and-Roles): the
list of every login — email, role, linked roster member, whether they've
signed in yet — plus the invite form. Covered in detail in
[Accounts and Roles](Accounts-and-Roles#inviting-everyone-else).

## Developer: act as role

Visible only when the app runs on browser-local storage (no backend): a
switcher that makes the app treat you as an admin, coach, or paddler —
handy for previewing what [paddlers will see](My-Page-for-Paddlers) before
setting up real accounts. It's a preview, not security.
