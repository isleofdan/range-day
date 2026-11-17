# About Range Day
Written 2026-11-16 by a Claude Code session from the files in this folder; "Unknown" means the files did not say.

## What it is
A realistic long-range target-shooting game for one player, on an Android phone and a Windows computer: steel plates from 100 to 1,000 yards in dry canyon hills, on two courses modeled on public ranges north of Los Angeles. The player looks through the rifle's real sight, zeroes the rifle on paper in real clicks, then works out drop and wind for each distance himself. It opens as a phone page behind a sign-in form: a home screen to pick the course, rifle and load, a zero bench, and a firing line.

## What it plugs into (in and out)
In: nothing. Every figure the game uses is in its own data files (`data/*.json`); the app calls no outside service.
Out: nothing. The zero, the sight settings and the shot log live in the player's browser (`localStorage`); no records leave the device. Crash reporting (Sentry) is wired in by the kit but switched off (`SENTRY_DSN` empty in `fly.toml`).

## How it is built
Plain JavaScript on a small Node server, copied from the starting kit (`isleofdan/starting-kit`): the kit's sign-in page, status page, phone-install files and checks, plus this app's data files, one physics engine (`public/engine.js`, which both the pages and the tests load), and three screens drawn on a canvas, with sounds made in code. No build step and no runtime dependency beyond the kit's two Sentry packages. A change is pushed as a branch, checked by the "Checks" workflow, merged by Dan's yes, and put live by running the "Deploy" workflow by hand, which builds the Docker image on Fly.io and proves the sign-in.

## Where it runs and how to tell it is alive
On Fly.io in Tokyo as the app `range-day-dan`, at https://range-day-dan.fly.dev once deployed. To check it is alive, open https://range-day-dan.fly.dev/alive: it answers one line, "alive since <time> · <version>". Last check: not yet deployed at the time of writing (2026-11-16); the Deploy workflow has not been run.

## Which hand-off route it is on
Not yet set. (This line is filled in by a later step of Dan's build plan.)

## Which assistants can reach it
A Claude Code session reaches the repository on GitHub (`isleofdan/range-day`) and runs the app on its own machine with `npm run dev`; none can sign in to the live app without the passphrase, which only Dan holds. No connector, Grokbot or ChatGPT door was found in the files.
