# Getting Started — VS Code + Claude Code

For every teammate. Setup takes about 30 minutes. After that, follow [ROADMAP.md](./ROADMAP.md) one task at a time.

---

## Step 0 — Security first (team lead, once)

The old `apps/api/.env` was shared inside a zip, so treat those keys as exposed.

1. Supabase Dashboard → **Project Settings → API Keys**: create a new secret key and revoke the old one.
2. Supabase Dashboard → **Project Settings → Database**: reset the database password.
3. Put the new values in your local `apps/api/.env` (copy from `apps/api/.env.example`). Share them with teammates privately, never through git, chat screenshots, or zips.

---

## Step 1 — Put this project into your GitHub repo

The zip has **no `.git` folder and no `.env` files**, so it can't overwrite your git history or secrets.

1. In VS Code, commit and push anything unfinished on your current branch.
2. Switch to an up-to-date main branch and create a new branch (Terminal → New Terminal):
   ```powershell
   git checkout master        # or main
   git pull
   git checkout -b chore/docs-kit
   ```
3. Unzip `VERA.zip` somewhere temporary (e.g. `Downloads\VERA-kit`). Copy **everything inside** its `VERA` folder into your project folder and choose **Replace** when asked. In PowerShell:
   ```powershell
   Copy-Item -Path "$HOME\Downloads\VERA-kit\VERA\*" -Destination "C:\path\to\your\VERA" -Recurse -Force
   ```
   Make sure the folders `.claude`, `.github`, and `.vscode` arrived too (in File Explorer: View → Show → Hidden items).
4. Check the result:
   ```powershell
   git status          # new: CLAUDE.md, docs/, scripts/, supabase/, .claude/, ... ; modified: package.json, .gitignore, svc files (comments only)
   pnpm install
   pnpm algo:check     # should print: VERA-ALGO check passed
   ```
5. Commit, push, open a pull request, and merge it:
   ```powershell
   git add -A
   git commit -m "chore: add VERA docs kit, Claude Code setup, and algorithm markers"
   git push -u origin chore/docs-kit
   ```
6. Teammates: `git pull` on main, then copy each `.env.example` to `.env` and fill in the values.

---

## Step 2 — Install Claude Code in VS Code

**Requirements:** VS Code 1.94 or later (Help → About) and a paid Claude plan (Pro, Max, Team, or Enterprise) or a Claude Console account. No API key is needed when you sign in with a Claude plan.

1. Press `Ctrl+Shift+X`, search **Claude Code** (publisher: Anthropic), and click **Install**.
2. Open any file. Click the **Spark icon** at the top-right of the editor (or the Spark icon in the left Activity Bar).
3. Click **Sign in** and finish in the browser.
4. Drag the Claude panel to the **right sidebar** so you can see code and chat side by side.
5. Accept VS Code's prompt to install the **recommended extensions** (Todo Tree, ESLint, Tailwind, Python, Mermaid preview). If you missed it: Extensions → filter `@recommended`.

The extension includes its own copy of Claude Code. You only need the separate command-line install if you want to type `claude` in the terminal.

Official guide: https://code.claude.com/docs/en/vscode-extension

---

## Step 3 — Configure it for this project

The repo already contains:
- `CLAUDE.md` — project rules Claude reads automatically.
- `.claude/settings.json` — Claude may run `pnpm test`, `pnpm lint`, `pnpm algo:*`, and git status/diff without asking; it **cannot** read `.env` files or `git push`.
- `.claude/commands/` — `/task`, `/done`, `/algo`, `/migration`.

Recommended VS Code user setting (`Ctrl+,` → search "Claude Code"):
- **Initial Permission Mode** → `plan`, so every new conversation starts by planning instead of editing.

**Permission modes** (click the mode indicator under the prompt box):

| Mode | When to use it in VERA |
|---|---|
| **Plan** | Start of every task. Claude writes a plan; VS Code opens it as a document where you can add comments before approving. |
| **Manual** | While Claude implements. You see a side-by-side diff for each edit and accept or reject it. Recommended while learning the codebase. |
| **Auto / Edit automatically** | Only for small, low-risk tasks you've already planned (e.g. renaming, formatting). |

**Check that it works.** In a new Claude conversation, send:
> Read CLAUDE.md and tell me the 12 non-negotiable rules in one line each.

Then type `/` and confirm `task`, `done`, `algo`, and `migration` appear. If a command is missing in your version, open `.claude/commands/<name>.md` and paste its text as your prompt (replace `$ARGUMENTS` with the task ID).

---

## Step 4 — Your first sessions

Follow the **solo sprint** in [ROADMAP.md](./ROADMAP.md) §4, Day 1:

1. **S1 (by hand):** rotate keys, then apply the schema and seed in the Supabase SQL Editor.
2. New Claude conversation → Plan mode → `/task S2` (Python service in `pnpm dev`).
3. New conversation → `/task S3` (API foundation, auth, seed admin + HR).
4. New conversation → `/task S4` (web shell and login).

Day 1 is done when `pnpm dev` runs all three apps and HR and applicant accounts land on their own pages.

---

## Step 5 — Daily workflow

```
git checkout master && git pull
git checkout -b feat/p4-3-apply-endpoint
```
1. New Claude conversation (Plan mode) → `/task P4.3`.
2. Read the plan. Comment on anything that conflicts with the PRD. Approve.
3. Switch to **Manual** mode and review each diff as Claude edits.
4. Run the app yourself (`pnpm dev`) and try the feature.
5. `/done` → Claude runs tests, lint, `algo:check`, updates CHANGELOG and ROADMAP, and proposes a commit message.
6. Commit from the Source Control panel, push, open a PR (template auto-fills), get a teammate's review, merge.

**Tips**
- Select code and press `Alt+K` to reference exact lines (e.g. `@algorithm.py#120-140`) in your prompt.
- Made a mess? Hover a message → **Rewind code to here**.
- Long conversation getting slow? Start a new one, or type `/compact`.
- `/usage` shows how much of your plan's limit you've used.
- If Claude asks a business-rule question, decide as a team and write the answer into `docs/PRD.md`.
- Read and understand every line before committing. The panel will ask you about this code.

---

## Step 6 — See the highlighted algorithm code

- **In the editor:** with Todo Tree installed, every `VERA-ALGO[...] BEGIN/END` line is highlighted yellow on navy. Open the Todo Tree panel (left Activity Bar) → **VERA-ALGO** to jump to each step.
- **Index:** `pnpm algo:map` → `docs/ALGORITHM_INDEX.md` (file + line links for every step).
- **Handout:** `pnpm algo:snippets` → `docs/ALGORITHM_CODE.md` (all algorithm code in pipeline order; print it for the defense).
- **Review with Claude:** `/algo` or `/algo COS-01`.
- **Explanation:** `docs/ALGORITHM.md` (formulas, worked example, walkthrough, panel Q&A).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| No Spark icon | Open a file (a folder alone isn't enough), or Command Palette → **Developer: Reload Window**. |
| "Not logged in" | Type `/login`, or reload the window. |
| Claude edits without asking | Change the mode indicator to **Plan** or **Manual**. |
| `[svc] venv not found` | Create the venv and install deps: `cd apps/svc` → `python -m venv .venv` → `.venv\Scripts\pip install -r requirements.txt`. |
| svc returns 401 / 503 | `SVC_INTERNAL_KEY` is missing (503) or differs (401) between `apps/svc/.env` and `apps/api/.env`. Set the same value in both and restart `pnpm dev`. |
| `pnpm dev:turbo` / `test:turbo` fails with `spawn UNKNOWN` | Windows Smart App Control blocks the unsigned `turbo.exe`. Use `pnpm dev` / `pnpm test` (they use `pnpm -r`, no turbo). |
| `pnpm algo:check` fails | It lists the file and line; usually a moved function lost its BEGIN/END marker. |
