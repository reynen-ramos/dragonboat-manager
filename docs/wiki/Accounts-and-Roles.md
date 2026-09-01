# Accounts and Roles

Out of the box the app needs no accounts — one device, one browser, full
featured. **Club mode** adds a shared database with real sign-in: several
phones seeing the same club, live, with each person's powers matched to
their role. (Setting up the backend itself is an operator task — see
`supabase/README.md` in the repository; this page covers using it.)

## Signing in

The app shows a sign-in card until you're known:

- **Email link** — type your address, tap *Email me a sign-in link*, open
  the link on the same device. No password exists at all.
- **Continue with Google** — one tap, if the club has it enabled.

> **Tip for installed apps:** an email link opens in your browser, not the
> installed app icon. If you've installed the app to your home screen,
> Google sign-in is the smoother path.

Sign out from the sidebar (desktop) or the last slot of the bottom bar.

## First user: founding the club

The first person signs in cold and lands on the *Almost there* screen —
their email isn't registered with any club. Type a club name, tap
**Create the club**, and they're its **admin**, looking at an empty club
ready for [setup](Getting-Started#setting-up-your-own-club) (or the demo).

## Inviting everyone else

Invitations are just registered emails — no invitation email is sent, so
tell people yourself ("sign in at ⟨the app's address⟩ with this email").

In **Settings → Access** an admin:

1. Types the person's email, picks a **role**, and — for paddlers —
   **links the login to their roster member**. The link is what connects
   "this login" to "this paddler": their sign-ups, results, and My Page.
2. The row shows *hasn't signed in yet* until the person's first sign-in,
   which connects automatically.

The same screen changes roles, re-links members, and revokes access (never
your own). A member's linked login can also be started from their member
page.

If someone signs in **before** being invited, they see the *Almost there*
screen — an admin registering their email fixes it; no re-registration
needed on their side.

## What each role can do

| | Admin | Coach | Paddler |
|---|---|---|---|
| See schedules, lineups, results, rankings | ✅ | ✅ | ✅ |
| Answer **their own** sign-up | ✅ | ✅ | ✅ (their one write) |
| Edit their own contact details | ✅ | ✅ | ✅ |
| Manage members, events, crews, seating, race times, trials | ✅ | ✅ | — |
| Record sign-ups on others' behalf | ✅ | ✅ | — |
| Dashboard, Members list, Reports | ✅ | ✅ | — |
| Settings: club rules, types, backups | ✅ | — | — |
| Access management (invites, roles) | ✅ | — | — |

These aren't just hidden buttons — the **database itself refuses**
out-of-role writes and reads. A paddler's app also *looks* different: see
[My Page](My-Page-for-Paddlers).

### Paddler privacy

Paddlers see the roster as a **directory**: names, gender, sides, zones,
statuses — everything needed to read a lineup. What they never see on
clubmates: contact details, emergency contacts, weight, date of birth, and
coach notes. That filtering happens in the database, on every request.
Their own row they see in full.

## Live sync

In club mode, open devices stay in sync **live** — a paddler's sign-up tap
appears on the coach's sheet in under a second, a coach's seating change
appears on every open lineup, no refresh. Your own taps paint instantly
(sign-up answers and seat drops don't wait for the network; if a write is
refused, it visibly snaps back with an explanation).

Two honest limits: the app **doesn't write offline** in club mode — it
opens, shows a banner, and refuses edits until the connection returns —
and right after a whole-backup import the live stream can lag a minute or
two while the server catches up.

## Multiple clubs

Every club is fully separate — its own roster, events, settings, and
access list. A founding user creates their own; nothing is shared between
clubs.
