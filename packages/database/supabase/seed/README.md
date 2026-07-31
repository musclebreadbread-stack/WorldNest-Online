# Seed scripts

Seeds are **not** migrations. They live outside the numbered sequence in
`../migrations/` because they insert throwaway data, are safe to re-run, and must
never be part of a production project's schema history.

## `test_accounts.sql`

Creates three confirmed accounts so a maintainer can sign in and test the game
without registering by hand:

| Email                    | Password       | Username  |
| ------------------------ | -------------- | --------- |
| `tester1@worldnest.test` | `worldnest123` | `Tester1` |
| `tester2@worldnest.test` | `worldnest123` | `Tester2` |
| `tester3@worldnest.test` | `worldnest123` | `Tester3` |

Three accounts rather than one, because multiplayer needs more than one player:
sign in as `tester1` in one browser and `tester2` in another to see remote
players, name tags and chat.

### Rules

1. **Run it after `migrations/002_gameplay_schema.sql`.** The accounts rely on
   the `handle_new_user` trigger `002` installs to create their `profiles` and
   `player_state` rows. The script does not insert those rows itself.
2. **Never run it against a production project.** It writes fake `auth.users`
   rows with a password published in this repository. Anyone who reads this file
   can then sign in to that project.
3. It is idempotent — every statement is `on conflict do nothing`, so running it
   twice changes nothing.
4. To remove the accounts again, uncomment the cleanup block at the bottom of
   the file. Deleting the `auth.users` rows cascades to everything else,
   including anything those testers built in the shared world.

### How to run it

- **Supabase**: paste the whole file into the SQL Editor and run it.
- **Locally against a throwaway Postgres**: `pnpm db:verify` applies it as part
  of the harness and asserts the accounts came out right, including that
  `encrypted_password` really does verify against `worldnest123`.
