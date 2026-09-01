# FAQ and Troubleshooting

**Where did my club go?**
In browser-local mode the club lives in one browser on one device. A
different browser, a private window, another device, or cleared site data
all mean an empty app. Restore your latest backup (Settings → Restore
backup) — and see [Backups and Your Data](Backups-and-Your-Data) for why
exporting regularly matters. For a club that exists on every device, set up
[club mode](Accounts-and-Roles).

**Fill boat won't seat someone — why?**
It only seats people who are eligible *and* asked: active members who
signed up In or Maybe (never Out, never unasked once sign-ups exist), not
already seated in another crew of the same category, and matching the
category (a Women's crew takes only women; a Mixed crew keeps enough seats
for the minimum-women rule). The dialog's preview says who it picked and
what it couldn't fill.

**A paddler shows a warning triangle on the boat.**
Open the **Checks** panel — it names every issue: not signed up, tentative
(said Maybe), seated on their wrong side, double-booked in the category,
age-division mismatch, and so on. Warnings are advisory; problems are the
ones to fix before racing.

**I typed a wrong race time.**
Just retype it — placements are always derived from times, so the whole
heat reorders itself. Clearing the box removes the time entirely.

**Two crews have the same time. Who's first?**
Both are — ties share a placement, and the next crew skips one (two 1sts,
then a 3rd), as on any regatta results sheet.

**Why can't I delete an event type / training kind / discipline?**
It's in use — events or sessions still wear it. Re-type those first. The
last remaining type also can't be deleted (the event form would have
nothing to offer).

**The sign-up sheet warns "not signed up" for someone I seated.**
That warning only appears once *anyone* has answered for the event — it
means this paddler was seated without answering. Either record their
answer, or ignore the advisory if that's how your club works.

**A paddler signed in but sees "Almost there — this email isn't registered".**
An admin needs to register that exact email in Settings → Access. The
person doesn't need to do anything again afterwards — the connection is
automatic. Check the spelling: the invitation email must match the one they
sign in with.

**A paddler's My Page says their login isn't linked to the roster.**
Registered, but not linked to a member. Settings → Access → pick their
roster member in the row's member dropdown.

**Paddlers see Edit-looking things they can't use?**
They shouldn't — paddler screens hide manage controls, and the database
refuses such writes regardless. If a paddler ever finds an edit control
that works on club data, that's a bug worth reporting.

**Changes from another device aren't appearing.**
In club mode they should appear within a second or two. Check the offline
banner first. Right after restoring a large backup, live updates can lag a
minute or two while the server catches up — switching away and back to the
tab refetches immediately. In browser-local mode there is no cross-device
sync at all (only tabs of the same browser stay in sync).

**Restore refused my backup file.**
The refusal message says why: damaged rows (the file was edited or
truncated — nothing was imported, your current club is untouched) or a
newer app version made it (update the app first). Files the app exported
and nobody edited always restore.

**Can I undo a delete?**
Deletes of members, events, categories, crews, and time-trial sessions all
offer **Undo** in a toast right after — restoring everything the cascade
removed, ids and all. The toast stays until dismissed. "Clear everything"
and "Load demo club" are the two exceptions — back up first.

**Printing shows the whole app, not just the sheet.**
It shouldn't — printing from the lineup page or a report strips the app
chrome automatically. Use the in-app **Print** / **Crew sheet** buttons (or
the browser's print on those pages) rather than screenshotting.

**Something else is wrong.**
Open an issue on the repository with what you did, what you expected, and
what happened instead — screenshots help. Export a backup first if data
looks odd; the file is also the best diagnostic evidence.
