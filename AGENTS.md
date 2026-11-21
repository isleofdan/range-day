# Repository instructions for Codex

Before work, read and follow `CLAUDE.md`, `SIGN.md`, `README.md` and `PLAN.md`
in this repository. `CLAUDE.md` is the existing rule source; its name does not
restrict those rules to Claude. Retain all of its data, privacy and release rules.

A machine session never merges any pull request. Elsewhere, merge/deploy requires
Dan's explicit authorization for the action and target. Use the authorized
repository workflows; preserve restart/session coordination. Never expose
credentials, bypass refusals, or weaken effective permissions to continue work.
Legacy close-out instructions do not authorize publication beyond the task scope.

This file is an instruction entry point, not an enforcement hook. Claude settings
do not configure Codex permissions. Verify the actual executor sandbox/approval
controls before relying on them; report an unsupported boundary rather than bypass it.

## Your side of this app

Claude and Codex split this app's work: see `CLAUDE.md`, "Who works on what",
and the lists in `scripts/owners.mjs`. Codex leads the picture (`PICTURE`) and
may work on the shared files; it leaves the real-figure files (`REAL`) alone
and names its branches `codex/…`, which the Checks workflow holds to. When a
job needs a real figure changed, say what is needed on the `range-day` card
and stop there.
