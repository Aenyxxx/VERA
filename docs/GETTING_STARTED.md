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

## Step 4 — Your first sessions (Phase 0)

Do these in order. Use **one new conversation per task** so Claude's context stays focused.

| # | Task | Who does what |
|---|---|---|
| 1 | P0.1 Secrets | You: Step 0 above. |
| 2 | P0.5 Database | You, in Supabase SQL Editor: back up, drop the old test tables, run `supabase/migrations/20261006000000_initial_schema.sql`, then `supabase/seed.sql` (DATABASE_SCHEMA.md §7). Claude can't reach your Supabase project. |
| 3 | `/task P0.2` | Claude: repo hygiene (lockfiles, `.gitattributes`, README check). |
| 4 | `/task P0.3` | Claude: start the Python service from `pnpm dev`. Then you create the venv once (CONTRIBUTING.md §1). |
| 5 | `/task P0.4` | Claude: `@vera/shared` constants package. |
| 6 | `/task P0.6` → `/task P0.7` | Claude: API skeleton and auth (`/api/me`, `/api/health`). |
| 7 | `/task P0.8` | Claude: web skeleton with the VERA design tokens, layouts, and routes. |
| 8 | `/task P0.9` | Claude: svc internal key. |

Phase 0 is done when `pnpm dev` starts web, api, and svc, `/api/health` is green, and you can click through the placeholder pages by role.

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
| `pnpm dev` doesn't start svc | Expected until task P0.3 is done. Start it manually: `cd apps/svc` → `.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000`. |
| `pnpm algo:check` fails | It lists the file and line; usually a moved function lost its BEGIN/END marker. |
