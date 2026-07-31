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
  "landing.subtitle":
    "Explore procedurally generated worlds, build, and play with friends",
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
    "WASD / Arrows · 1-8 hotbar · I inventory · E harvest / plant · B build · M map · J quests · P settings · Esc close · Enter chat",
  "hud.health": "Health",
  "hud.energy": "Energy",
  "hud.signOut": "Sign out",
  "hud.signingOut": "Signing out...",
  "hud.coins": "{count} coins",
  "hud.coinsAdjusted": "Balance updated by the server",

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

  "npc.pip.name": "Pip the Gardener",
  "npc.juno.name": "Juno the Shopkeeper",
  "npc.ada.name": "Ada the Explorer",

  "npc.activity.home": "At home",
  "npc.activity.work": "Working",
  "npc.activity.market": "At the market",
  "npc.activity.rest": "Resting",

  "dialogue.close": "Leave",
  "dialogue.hint": "Press 1-4 or tap an answer",
  "dialogue.option.bye": "Goodbye for now!",
  "dialogue.option.back": "Ask something else",
  "dialogue.pip.greeting":
    "Welcome to WorldNest! I look after the flower beds around here. Can I help with anything?",
  "dialogue.pip.tips":
    "Stand next to a patch of grass and press E to turn it into a field, then press E again to sow your seeds. Come back in a few hours and the wheat will be ready.",
  "dialogue.pip.option.tips": "How do I start a farm?",
  "dialogue.juno.greeting":
    "Welcome to my little shop! I buy whatever you gather and sell whatever you still need.",
  "dialogue.juno.prices":
    "I pay a bit less than I charge, which is how the shop keeps going. Gather plenty and you will still come out ahead.",
  "dialogue.juno.option.shop": "Show me what you have",
  "dialogue.juno.option.prices": "How do your prices work?",
  "dialogue.ada.greeting":
    "Hello there, explorer! I keep a list of jobs that need doing around the village.",
  "dialogue.ada.quests": "Pick a job and I will write your name next to it.",
  "dialogue.ada.report": "All finished? Tell me which job you did.",
  "dialogue.ada.option.quests": "What needs doing?",
  "dialogue.ada.option.report": "I finished a job",
  "dialogue.ada.option.wood": "Gather firewood",
  "dialogue.ada.option.fence": "Fence the garden",
  "dialogue.ada.option.greet": "Say hello to Pip",

  "touch.stick": "Movement stick",
  "touch.interact": "Use",
  "touch.place": "Place",
  "touch.map": "Map",

  "shop.title": "Shop",
  "shop.close": "Close (Esc)",
  "shop.hint": "Fixed prices. The shop always pays a little less than it charges.",
  "shop.item": "Item",
  "shop.held": "held {count}",
  "shop.buy": "Buy",
  "shop.sell": "Sell",
  "shop.buyQuantity": "Buy {quantity}",
  "shop.sellQuantity": "Sell {quantity}",
  "shop.buyPrice": "Costs {coins} coins",
  "shop.sellPrice": "Pays {coins} coins",

  "quest.title": "Quest log",
  "quest.close": "Close (J)",
  "quest.empty": "No jobs yet. Ada keeps the village list, so go and ask her.",
  "quest.progress": "{current} / {target}",
  "quest.state.available": "Offered",
  "quest.state.active": "In progress",
  "quest.state.completed": "Done",
  "quest.turnIn": "Hand in",
  "quest.tracking": "Current job",
  "quest.collect_wood.title": "Firewood for the village",
  "quest.collect_wood.description": "Gather 5 wood and show it to Ada.",
  "quest.build_fence.title": "Fence the garden",
  "quest.build_fence.description": "Place 2 fences anywhere, then tell Ada.",
  "quest.greet_pip.title": "Say hello to Pip",
  "quest.greet_pip.description": "Pip the gardener loves visitors. Go and talk to him.",

  "item.wood": "Wood",
  "item.stone": "Stone",
  "item.ore": "Ore",
  "item.fiber": "Fiber",
  "item.flower": "Flower",
  "item.wheat_seed": "Wheat Seed",
  "item.wheat": "Wheat",
  "item.carrot_seed": "Carrot Seed",
  "item.carrot": "Carrot",
  "item.melon_seed": "Melon Seed",
  "item.melon": "Melon",
  "item.fence": "Fence",
  "item.chest": "Chest",

  "weather.clear": "Clear",
  "weather.rain": "Rain",
  "weather.snow": "Snow",
  "weather.fog": "Fog",
  "weather.storm": "Storm",
  "weather.rainbow": "Rainbow",
  "weather.aurora": "Aurora",
  "weather.wind": "Windy",

  "season.spring": "Spring",
  "season.summer": "Summer",
  "season.autumn": "Autumn",
  "season.winter": "Winter",
} as const;
