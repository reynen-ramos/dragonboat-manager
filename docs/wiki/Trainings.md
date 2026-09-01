# Trainings

The **Trainings** section is the club's weekly rhythm, read the way a coach
plans: **This week**, **Next week**, **Later**, and the season behind you
folded by month (tap "Show N trainings" to unfold a month). Every row shows
the weekday, date, location, and the training kind badge; the **Sign-ups**
button on each row jumps straight to that session's sheet.

Races and one-off events live under [Events](Events-and-Race-Day) — but the
**Calendar** view here shows the *whole* club month (trainings, races, and
other events in their own colours), because a month grid is where everything
is read at once. Tapping an empty day starts a new training on that date.

## Creating a training

**New training** opens the event form with a practice type pre-selected.
Give it a name, date, optionally a location, a training kind
(**Water / Land / Supplementary** by default — [editable](Settings-and-Club-Rules#training-kinds)),
and notes.

## Repeating trainings

The schedule is usually a *pattern* — so the form can create the whole term
at once. For a new training, set **Repeats** to *Weekly, on chosen days*:

- A **Mon–Sun toggle row** appears, pre-set to the start date's weekday.
  Pick every weekday the session runs (e.g. Sat + Sun for water).
- **Until** replaces the end date — default eight weeks out, maximum a year.
- The form counts as you go: *"Creates 24 sessions."* — and the submit
  button itself says **Create 24 sessions**.

Each created session is an ordinary event: it has its own sign-up sheet,
appears on the calendar, counts in reports, and can be edited or deleted
individually. There is no series object to manage — the series *is* its
sessions.

**Re-running a series is safe.** Dates that already hold a session of the
same name are skipped (the caption says so), so extending "Water Training"
until November never doubles a Saturday.

Races don't repeat, and editing an existing session edits only that
session.

## Training kinds

The kind (Water, Land, Supplementary, or anything your club
[adds](Settings-and-Club-Rules#training-kinds)) is a label that follows the
session everywhere: the dashboard groups upcoming trainings by it, the
Attendance report counts trainings as a whole, and the badge appears on
lists and sign-up rows.

## Boats at training

A training can carry categories and crews exactly like a race — useful for
seating a training boat and having the [bench report](Reports#bench) notice
who signed up but never got a seat. Open the training and add a category
(e.g. a 10-seat Open) like at any event. Gym nights need none.

## Time trials

The **Time trials** button in the header leads to the individual
time-trials module — see [Time Trials](Time-Trials).
