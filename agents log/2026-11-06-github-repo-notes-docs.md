# 2026-11-06: GitHub repo, project notes, docs/ site

## Changed
- **New `NOTES.md`** (root): the user's project notes for their AI teacher, with five parts:
  - who did what (user vs AI);
  - a timeline;
  - the user's design decisions and what each one did to the study;
  - the results in three lines;
  - an empty "In my own words" section for the user to write.

  The facts come from the user's own messages in the session transcripts and their interview answers. Two `[bracketed]` placeholders need the user: the tool behind the 3 Nov changes, and which deck slides they wrote.
- **`README.md`:**
  - new top section: the project overview, a links table, the study in one minute, and "How this was made", crediting xlcobra100 and Claude Code;
  - the old game README now sits under `## The game: Halcyon Council`, with every heading demoted one level.
- **New `docs/`:**
  - `index.html`: landing page.
  - `findings.html` and `highlights.html`: copies of `study/runs/main/*.html` with a doctype/charset/viewport skeleton, `body{margin:0}`, the claude.ai cross-link replaced by `findings.html`, and the `claude:viewport-fit-sides` meta removed.
  - `briefs/game-brief.md`: the 1 Nov game prompt, verbatim.
  - `presentation.pdf` is linked but **not there yet**. The user exports it from the Slides artifact https://claude.ai/artifact/8URKYCgsej4LMS6bn9WsTb.
- `study/runs/main/checks/prior-plan.mjs`: its `file:///C:/Users/<user>/...` imports are now relative (`../../../`).
- `.gitignore`: keeps `study/runs/**/events.log` (the `*.log` rule would drop it), and ignores `.claude/settings.local.json`.
- **New `study/runs/main/checks/prior-plan.rerun-2026-11-06.out.txt`:** see Surprises.
- `git init` and a **private** GitHub repo, `xlcobra100/who-wins-the-room`. Commit identity is set repo-locally to the GitHub noreply address.

## Why
The user wants the work on GitHub, mainly to show an AI teacher, with notes that make their own part clear. The notes are deliberately candid:
- the AI wrote the code;
- the user designed the study, made the calls and chose the analysis.

The user's own reflection is left for them to write.

## Not changed
- `study/runs/main/findings.html` and `highlights.html` keep their artifact form. Re-publishing them to claude.ai must not get a doubled skeleton. `docs/` holds the copies.
- Root QA screenshots, `capture-qa.js` and `promt.txt` stay where they are (capture-qa writes to root; `promt.txt` is the verbatim study brief, and NOTES and the README link to it).
- The deck itself was not edited.

## Surprises for the next agent
- **`prior-plan.mjs` does not reproduce.** Re-run on 6 Nov with the same seeds (Ollama 0.40.15), all 20 answers differ from `prior-plan.out.txt`. Dam now backs lowering plus a spillway (4/5), where the saved run had "do nothing / evacuate". The 5 Nov agents-log claim ("rerun gave identical output") no longer holds. Treat "the model's prior plan" as unstable and keep it out of slides.
- Any `docs/*.html` page must be regenerated when its source changes. The node one-liner: prepend the skeleton, drop the claude meta, swap the findings URL.
- The repo is private, so GitHub Pages is unavailable on a free plan and `docs/` only renders when opened locally.
- The deck (Slides artifact) still has user placeholders: "[Video]", "[What it showed you…]", and a "Probable technical causes???" slide. The "example" slide headline says Drew won "using a factually wrong claim". In p2-31 the deciding error was Morgan's own: she argued the veto against her plan. The wrong-claim story is p3-41.

## How to verify
- `git -C . status` should be clean after the push.
- `gh repo view xlcobra100/who-wins-the-room --json visibility` should print `PRIVATE`.
- `grep -c "REPO_URL\|AUTHOR_NAME\|PAGES_URL" docs/index.html README.md` should print 0 for both files.
