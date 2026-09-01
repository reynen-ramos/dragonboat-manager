# Backups and Your Data

## Where data lives

- **Browser-local mode** (the default): everything is stored in this
  browser on this device. Nothing leaves your machine. The flip side:
  clearing the browser's site data — or losing the device — deletes the
  club. **Backups are your safety net.**
- **Club mode** ([sign-in](Accounts-and-Roles)): data lives in the club's
  own database. Device loss no longer matters; backups become an archive
  and an escape hatch rather than a lifeline. Backups still work
  identically.

The roster holds personal data — birth dates, emergency contacts. Treat an
exported backup with the same care as the spreadsheet it replaces.

## Export backup

**Settings → Export backup** downloads the entire club — members, events,
categories, crews, lineups, sign-ups, race times, time trials, settings —
as a single JSON file, named with the date. Keep it somewhere that isn't
this device.

The app tracks when you last exported and **nudges you** when it's been too
long (the dashboard shows the reminder; you can snooze it). Export after
anything you'd hate to retype.

## Restore backup

**Settings → Restore backup** replaces the current club with the file's
contents. Two things to know:

- It's **all or nothing** by design: a file with damaged rows is refused
  outright, with a message saying what was wrong — a clear "this file is
  not readable" beats silently installing half a backup over a good club.
  A backup from a newer app version is likewise refused ("update the app,
  then open it again").
- Backups are **portable across storage modes**: a file exported from
  browser-local storage restores into a signed-in club and vice versa —
  every id, lineup, and result intact. This is also the migration path
  when a club moves from one phone to a shared database.

## Load demo club

Replaces everything with the [demo](Getting-Started#try-the-demo-first).
Great for exploring; not reversible except by restoring your own backup —
so export first if the club is real.

## Clear everything

Deletes the whole club after a confirmation. In browser-local mode this
wipes this browser's copy; in club mode it empties the club's database for
everyone. Export first. Always export first.

## Older backups

The app opens old backups gracefully: collections added since (say, time
trials) simply load empty, and settings pick up new defaults for anything
the file predates. Damaged rows at **startup** (as opposed to import) are
skipped with a visible warning rather than blocking the whole club from
opening — and the unreadable original is kept aside, never overwritten.

## Offline

The installed app opens without a connection.

- **Browser-local mode**: fully usable offline — the storage is the device.
- **Club mode**: read-only offline. A banner says so, and edits are
  refused until the connection returns — honestly, rather than pretending
  to save. There is no offline queue; don't seat a crew in a tunnel.
