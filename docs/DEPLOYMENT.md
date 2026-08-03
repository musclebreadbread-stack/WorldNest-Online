# Deployment Guide

This guide takes a fresh clone of WorldNest Online to a **live public URL** you can hand to a
tester. Every command in it is a command this repository actually runs; every dashboard step is one
only you can do, because it needs your own Supabase and Vercel accounts.

Read it in order. Steps 1-3 build the backend, step 4 proves the tree is deployable before you spend
a Vercel build on it, steps 5-9 put it online, and step 10 is how you know it worked.

| Step | What it produces                                                      | Where                  |
| ---- | --------------------------------------------------------------------- | ---------------------- |
| 1    | A Supabase project, its URL and anon key                              | Supabase dashboard     |
| 2    | The schema: three migrations, optionally the test accounts            | Supabase SQL Editor    |
| 3    | Sign-up that works without a confirmation mail                        | Supabase Auth settings |
| 4    | Confidence: the same build and the same production server Vercel runs | Your terminal          |
| 5    | The branch Vercel will import                                         | GitHub                 |
| 6    | A deployment                                                          | Vercel dashboard       |
| 7    | The two `NEXT_PUBLIC_*` variables in all three environments           | Vercel dashboard       |
| 8    | Sign-in that redirects back to _your_ domain                          | Supabase Auth settings |
| 9    | A custom domain (optional)                                            | Vercel dashboard       |
| 10   | A signed-off smoke pass                                               | A browser, twice       |

There is a Korean walkthrough of the same path in [`SETUP_GUIDE_KR.md`](SETUP_GUIDE_KR.md), section 9.

## Prerequisites

| Requirement       | Version / note                                            |
| ----------------- | --------------------------------------------------------- |
| Node.js           | 22+ (LTS)                                                 |
| pnpm              | 10+ — `corepack enable`                                   |
| Git               | any recent version                                        |
| GitHub account    | the repository has to be pushed somewhere Vercel can read |
| Supabase account  | free tier is enough                                       |
| Vercel account    | free Hobby tier is enough                                 |
| Docker (optional) | only for `pnpm db:verify` and the `Dockerfile`            |

You do **not** need any binary game assets: every texture and every sound is synthesised at runtime,
so there is no asset pipeline, no CDN step and nothing to license.

## 1. Create the Supabase project

1. Sign in at <https://supabase.com/dashboard> and click **New Project**.
2. Name it (`worldnest-online`), set a database password you keep, and pick the region closest to
   your players.
3. Wait for provisioning (1-2 minutes).
4. Go to **Settings → API** and copy two values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`, e.g. `https://abcdefgh.supabase.co`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> Never use the `service_role` key in this app. It bypasses Row Level Security, and both variables
> here are shipped to the browser by design (`NEXT_PUBLIC_*`).

## 2. Run the SQL

Open **SQL Editor → New query**, paste each file whole, and run them **in this order**:

| Order        | File                                                               | What it creates                                                                              |
| ------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 1            | `packages/database/supabase/migrations/001_initial_schema.sql`     | `profiles`, `player_state`, `worlds`, RLS, the seeded `Default World` row                    |
| 2            | `packages/database/supabase/migrations/002_gameplay_schema.sql`    | the `handle_new_user` trigger, `world_modifications`, `structures`, `crops`, `chat_messages` |
| 3            | `packages/database/supabase/migrations/003_progression_schema.sql` | `player_state.coins` and `player_quests`                                                     |
| 4 (optional) | `packages/database/supabase/seed/test_accounts.sql`                | three ready-to-use test logins                                                               |

Order is load-bearing. `002` installs the trigger that creates a `profiles` row on sign-up, so
without it nothing a player does can be saved, and the seed in step 4 relies on that same trigger.

### The optional test accounts

`seed/test_accounts.sql` creates three confirmed accounts so you can sign in immediately, and sign in
as two different players at once to test chat and remote players:

| Email                    | Password       | Username  |
| ------------------------ | -------------- | --------- |
| `tester1@worldnest.test` | `worldnest123` | `Tester1` |
| `tester2@worldnest.test` | `worldnest123` | `Tester2` |
| `tester3@worldnest.test` | `worldnest123` | `Tester3` |

> **Development and testing only.** That password is published in this repository, so anyone who can
> read the repo can sign in to any project you run this seed against. Never run it on a project that
> matters, and delete the accounts when you are done — the commented cleanup block at the bottom of
> the file does it, and see [`seed/README.md`](../packages/database/supabase/seed/README.md).

### Dry-run the SQL before you paste it anywhere

If you have Docker, you can check all four files apply cleanly without touching a real project:

```bash
pnpm db:verify
```

It starts a throwaway `postgres:16-alpine`, creates the roles and the stub `auth` schema Supabase
would otherwise provide, applies `001` → `002` → `003` → the seed with `ON_ERROR_STOP=1`, and asserts
the outcome — the policy counts, the seeded world, that the trigger provisions both rows from the
sign-up metadata, and that the seeded password really verifies. See
[DEVELOPMENT.md](DEVELOPMENT.md#verifying-sql-locally) for what the stub does and does not cover.

## 3. Turn off email confirmation (while testing)

**Authentication → Providers → Email → Confirm email → off → Save.**

With it on, a new sign-up cannot sign in until it clicks a link in a real mailbox, which the
`@worldnest.test` seed addresses do not have. The seeded accounts set `email_confirmed_at`
themselves, so they work either way; accounts _you_ register by hand do not. Turn it back on before
you invite anyone who is not a tester.

## 4. Verify the build locally — the same one Vercel runs

Run these three commands from the repository root. They are the exact commands the deployment
depends on, and they fail fast on the two things that actually break monorepo deploys: a lockfile
that does not match, and a web build that runs before its workspace dependencies.

```bash
pnpm install --frozen-lockfile                          # what Vercel's install step does
pnpm exec turbo run build --filter=@worldnest/web...     # web plus its four workspace packages
pnpm test:e2e                                            # against `next start`, the production server
```

The `...` in the filter is what pulls in `@worldnest/shared`, `@worldnest/ui`, `@worldnest/database`
and `@worldnest/game-engine` first — `apps/web` imports all four and cannot compile before they have
been built. `pnpm test:e2e` boots the app with `pnpm --filter @worldnest/web start`, which is the
same production server Vercel serves, so a pass here means the route guard and the real client bundle
work outside dev mode.

> `next start` prints a warning that `output: "standalone"` is set. That is expected and harmless:
> `apps/web/next.config.js` sets it for the `Dockerfile`'s multi-stage build, and both `next start`
> and Vercel ignore it.

For the whole gate — lint, unit tests, SQL, the Korean doc pair and the Docker image — see
[CONTRIBUTING.md](../CONTRIBUTING.md).

## 5. Push the branch

Vercel deploys what is on GitHub, not what is on your disk.

```bash
git push -u origin feat/mvp-foundation
```

Vercel builds every branch it is given: the default branch becomes the Production deployment and
every other branch gets its own Preview URL. If you would rather deploy from `main`, open a pull
request and merge first.

## 6. Import the repository into Vercel

1. <https://vercel.com/new> → **Import Git Repository** → pick `WorldNest-Online`.
2. Leave **Root Directory** at the repository root. That is what makes the committed
   [`vercel.json`](../vercel.json) apply:

   | Setting          | Value (from `vercel.json`)                             |
   | ---------------- | ------------------------------------------------------ |
   | Framework Preset | `nextjs`                                               |
   | Install Command  | `pnpm install --frozen-lockfile`                       |
   | Build Command    | `pnpm exec turbo run build --filter=@worldnest/web...` |
   | Output Directory | `apps/web/.next`                                       |

3. Set the environment variables (step 7) **before** the first build, then click **Deploy**.

Vercel reads `vercel.json` from whatever you set as the Root Directory. So if you prefer to point it
at `apps/web` instead, the root `vercel.json` is ignored and you must fill the same three commands in
by hand in **Settings → Build & Development Settings**, remembering that the install and build have
to run at the workspace root:

| Setting          | Value when Root Directory is `apps/web`                            |
| ---------------- | ------------------------------------------------------------------ |
| Install Command  | `cd ../.. && pnpm install --frozen-lockfile`                       |
| Build Command    | `cd ../.. && pnpm exec turbo run build --filter=@worldnest/web...` |
| Output Directory | `.next`                                                            |

Leaving the Root Directory alone is the simpler of the two, and it is the one this repository is
configured for.

## 7. Environment variables

**Settings → Environment Variables.** Add both, and tick **Production**, **Preview** _and_
**Development** for each:

| Name                            | Value                            |
| ------------------------------- | -------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | your Project URL from step 1     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon public key from step 1 |

If they are missing the build still succeeds — the app is written to boot without Supabase — and you
get a single-player sandbox with no accounts, no chat and no saving. That is the symptom to look for.
Changing a variable needs a **redeploy** to take effect, because `NEXT_PUBLIC_*` values are inlined
at build time.

## 8. Allow your domain in Supabase Auth — the step people miss

**This is the single most common deployment failure.** Sign-in appears to work and then bounces back
to `/auth`, or lands on `localhost:3000`, because Supabase refuses to redirect to a URL it was not
told about.

**Authentication → URL Configuration:**

| Field             | Value                                                                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Site URL**      | your production URL, e.g. `https://worldnest-online.vercel.app`                                                                                                                    |
| **Redirect URLs** | add `https://worldnest-online.vercel.app/**`, your custom domain if any, `https://*-yourteam.vercel.app/**` for preview deployments, and `http://localhost:3000/**` for local work |

Add every host you will actually open the game from. Preview deployments get a new hostname per
commit, which is why the wildcard entry is worth adding rather than one URL per deploy.

## 9. Custom domain (optional)

**Settings → Domains → Add**, enter the domain, and create the DNS record Vercel shows you (a `CNAME`
to `cname.vercel-dns.com` for a subdomain, or the `A` record it gives you for an apex domain). Wait
for the certificate to be issued, then **go back to step 8 and add the new domain** to the Site URL
and the redirect allow-list. A domain that works everywhere except sign-in is always this.

## 10. Post-deploy smoke checklist

Open the deployment and walk through it. Every line here is a thing no automated test in this
repository can reach, which is exactly why it is a checklist.

- [ ] The landing page renders and **Play Now** leads to `/auth`.
- [ ] Sign up a new account (or sign in as `tester1@worldnest.test` / `worldnest123`) and land on
      `/game`. If it bounces back to `/auth`, re-read step 8.
- [ ] The world draws, the clock reads something like `Day 1 · 07:20 · dawn`, and `WASD` moves you.
      Water blocks you.
- [ ] `E` harvests a tree, `M` opens the minimap, `P` opens the settings panel — switch the language
      and confirm the HUD changes.
- [ ] Talk to an NPC with `E`. Juno opens the shop; Ada gives out quests, and `J` shows the log.
- [ ] Sound plays after your first click (browsers block audio before a user gesture).
- [ ] Walk somewhere, spend a coin, take a quest, then **reload**. Position, inventory, coins and
      quest progress all come back. If they do not, `002` or `003` did not run.
- [ ] Open a second browser (or a private window) as `tester2@worldnest.test`. Each sees the other's
      character and name tag moving, and chat arrives in both. Reload — the chat history is still
      there.
- [ ] On a phone, the thumb-stick and the `E` / `B` / `Q` / `I` / `M` / `J` buttons appear and work.

## Troubleshooting

| Symptom                                                                                               | Cause                                                           | Fix                                                                                                                      |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Sign-in bounces back to `/auth`, or redirects to `localhost`                                          | the deployed domain is not in the Auth allow-list               | step 8 — add both the Site URL and the redirect URL                                                                      |
| Vercel build fails with `Cannot find module '@worldnest/shared'` (or `game-engine`, `ui`, `database`) | the web app was built without its workspace dependencies        | use the `--filter=@worldnest/web...` build command from step 6; check the Root Directory matches the table you filled in |
| Vercel build fails in the install step with a lockfile error                                          | `pnpm-lock.yaml` is out of date on the branch                   | run `pnpm install` locally, commit the lockfile, push                                                                    |
| The game loads but there are no accounts, no chat and nothing saves                                   | the `NEXT_PUBLIC_*` variables are missing from that environment | step 7, then **redeploy** — they are inlined at build time                                                               |
| Sign-up succeeds but sign-in fails                                                                    | email confirmation is on and the mail was never clicked         | step 3, or use the seeded accounts                                                                                       |
| Everything works except saving                                                                        | `002` and/or `003` never ran, so there is no `profiles` row     | run the missing migration, then register again — the trigger only fires for accounts created after it exists             |
| No sound until you click                                                                              | every browser's autoplay policy                                 | expected; the audio context is created on your first gesture                                                             |
| `next start` warns about `output: "standalone"`                                                       | `next.config.js` sets it for the Dockerfile                     | expected and harmless, locally and on Vercel                                                                             |

## Deploying the container instead

There is a multi-stage `Dockerfile` for anywhere that is not Vercel (Fly.io, Cloud Run, your own
box). It relies on `output: "standalone"`:

```bash
docker build -t worldnest:latest .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  worldnest:latest
```

Because `NEXT_PUBLIC_*` variables are inlined at build time, passing them at `docker run` only helps
if they were also present during `docker build`. For a real container deploy, pass them as build args
or build the image in the target environment. Steps 1-3 and 8 apply unchanged.
