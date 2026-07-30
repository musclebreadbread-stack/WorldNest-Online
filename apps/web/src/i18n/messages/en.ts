/**
 * English catalogue — the source of truth for every user-visible string.
 *
 * `MessageKey` is derived from this object, so adding a key here is what makes
 * it available (and makes the parity test demand it of the other 11 locales).
 * Keys are flat and dot-namespaced by surface; values may contain `{name}`
 * placeholders, which `translate()` interpolates.
 *
 * The auth and landing strings are asserted verbatim by `e2e/smoke.spec.ts`.
 */
export const en = {
  "common.loading": "Loading...",

  "landing.tagline": "A browser-based 2D MMO life simulation game",
  "landing.subtitle": "Explore procedurally generated worlds, build, and play with friends",
  "landing.play": "Play Now",

  "auth.signInSubtitle": "Sign in to your account",
  "auth.signUpSubtitle": "Create a new account",
  "auth.usernameLabel": "Username",
  "auth.usernamePlaceholder": "Choose a username",
  "auth.emailLabel": "Email",
  "auth.emailPlaceholder": "you@example.com",
  "auth.passwordLabel": "Password",
  "auth.passwordPlaceholder": "Enter your password",
  "auth.signIn": "Sign In",
  "auth.signUp": "Sign Up",
  "auth.submitting": "Please wait...",
  "auth.switchToSignUp": "Don't have an account? Sign up",
  "auth.switchToSignIn": "Already have an account? Sign in",
  "auth.genericError": "Authentication failed. Check your Supabase configuration.",

  "game.loading": "Loading game...",

  "hud.connected": "Connected",
  "hud.connecting": "Connecting",
  "hud.disconnected": "Disconnected",
  "hud.playersOnline": "Players online: {count}",
  "hud.coordinates": "X: {x} Y: {y}",
  "hud.chunk": "Chunk: {chunkX}, {chunkY}",
  "hud.controls":
    "WASD / Arrows · 1-8 hotbar · I inventory · E harvest / plant · B build · M map · P settings · Enter chat",
  "hud.health": "Health",
  "hud.energy": "Energy",
  "hud.signOut": "Sign out",
  "hud.signingOut": "Signing out...",

  "clock.format": "Day {day} · {time} · {phase}",
  "clock.phase.dawn": "dawn",
  "clock.phase.day": "day",
  "clock.phase.dusk": "dusk",
  "clock.phase.night": "night",

  "inventory.title": "Inventory",
  "inventory.close": "Close (I)",

  "build.title": "Build mode",
  "build.empty": "No placeable items in the hotbar.",
  "build.hint": "Q or click places on the faced tile · B exits",

  "chat.placeholder": "Press Enter to chat",
  "chat.unavailable": "Chat unavailable",
  "chat.ariaLabel": "Chat message",

  "settings.title": "Settings",
  "settings.open": "Open settings",
  "settings.close": "Close (P)",
  "settings.language": "Language",
  "settings.languageHint": "Saved on this device only.",
  "settings.sound": "Sound",
  "settings.masterVolume": "Master volume",
  "settings.musicVolume": "Music volume",
  "settings.mute": "Mute all sound",
  "settings.soundHint": "Sound starts after your first click.",

  "item.wood": "Wood",
  "item.stone": "Stone",
  "item.ore": "Ore",
  "item.fiber": "Fiber",
  "item.flower": "Flower",
  "item.wheat_seed": "Wheat Seed",
  "item.wheat": "Wheat",
  "item.fence": "Fence",
  "item.chest": "Chest",
} as const;
