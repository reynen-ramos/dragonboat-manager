# Reports

The **Reports** page reads the season back across every event — the sheets
a club secretary would otherwise build by hand. Four reports, each viewable
on screen, printable (the **Print** button strips all app chrome and adds a
title line), and exportable as CSV that opens cleanly in Excel.

**Date ranges** apply to Attendance, Results, and Bench: **This season**
(1 January to today — the default), **Last 90 days**, **All time**, or a
custom pair of dates, inclusive on both ends. A report run on race evening
includes today. Multi-day events count by their end date.

Throughout the reports: *seated* means holding a non-reserve place in a
crew; alternative plans count nowhere; events whose type behaves like
"other" count in no paddling statistics.

## Attendance

One row per member (status filter defaults to Active — and members with
zero activity **stay in the list**, because the paddler who never answers
is exactly who a coach is looking for). Trainings and races are counted
separately; per kind you see **said In / Maybe / Out**, **unanswered**
(events they were never recorded for), and **seated**. The header carries
how many trainings and races the range held.

## Results

Every past race in the range, newest event first, organised the way a
programme reads: event → category → race (count-aware labels — "Heat 1",
"Heat 2", "A Final"). Each row: place, crew, lane, time, and the gap to the
winner. Placement is always *among recorded entries* — the app never
claims a "win" beyond what was typed in.

## Composition

A snapshot of the roster **now** (no date range; status filter defaults to
Active), drawn as bars: status, gender, age bands aligned to the racing
divisions (Junior ≤18, U24, Premier, 40s, 50s, 60+), paddling side, weight
bands, and officials (can drum / can steer / both / neither). Missing
birth dates and weights get honest **Unknown** bars rather than being
skipped, and empty bands stay visible — a hole in the roster is
information.

## Bench

The morale report: who keeps saying **In** and not getting a boat. A member
is *benched* at an event when they said In but held no seat (reserve-only
counts as benched, flagged "listed as reserve"). An event only joins this
report once **someone** was seated there — an unbuilt training lineup
benches nobody. Rows sort by most-benched; the caption notes how many
events seated everyone who asked. An empty report is the goal.

## CSV files

Each report's **Download CSV** produces a dated file
(`attendance-2026-01-01-to-2026-09-01.csv` and so on). Results are
flattened one row per race entry; Composition exports slice/bucket/count.
The files use Excel-friendly encoding, and cell contents can't smuggle
spreadsheet formulas.

## Who sees reports

With [club sign-in](Accounts-and-Roles), Reports is a staff page — it
aggregates the whole membership. Paddlers see their **own** numbers on
[My Page](My-Page-for-Paddlers) instead.
