import type { LocaleMessages } from "../index";

/** Hindi (हिन्दी). */
export const hi: LocaleMessages = {
  "common.loading": "लोड हो रहा है...",

  "landing.tagline": "ब्राउज़र में खेलने वाला 2D जीवन-सिमुलेशन MMO",
  "landing.subtitle": "अपने आप बनने वाली दुनिया घूमें, निर्माण करें और दोस्तों के साथ खेलें",
  "landing.play": "अभी खेलें",

  "auth.signInSubtitle": "अपने खाते में साइन इन करें",
  "auth.signUpSubtitle": "नया खाता बनाएँ",
  "auth.usernameLabel": "उपयोगकर्ता नाम",
  "auth.usernamePlaceholder": "एक उपयोगकर्ता नाम चुनें",
  "auth.emailLabel": "ईमेल",
  "auth.emailPlaceholder": "you@example.com",
  "auth.passwordLabel": "पासवर्ड",
  "auth.passwordPlaceholder": "अपना पासवर्ड डालें",
  "auth.signIn": "साइन इन",
  "auth.signUp": "साइन अप",
  "auth.submitting": "कृपया प्रतीक्षा करें...",
  "auth.switchToSignUp": "खाता नहीं है? साइन अप करें",
  "auth.switchToSignIn": "पहले से खाता है? साइन इन करें",
  "auth.genericError": "साइन इन नहीं हो सका। Supabase सेटिंग जाँचें।",

  "game.loading": "गेम लोड हो रहा है...",

  "hud.connected": "जुड़ा हुआ",
  "hud.connecting": "जुड़ रहा है",
  "hud.disconnected": "कनेक्शन टूटा",
  "hud.playersOnline": "ऑनलाइन खिलाड़ी: {count}",
  "hud.coordinates": "X: {x} Y: {y}",
  "hud.chunk": "खंड: {chunkX}, {chunkY}",
  "hud.controls":
    "WASD / तीर · 1-8 हॉटबार · I बैग · E कटाई / बोना · B निर्माण · M नक्शा · P सेटिंग · Enter चैट",
  "hud.health": "जीवन",
  "hud.energy": "ऊर्जा",
  "hud.signOut": "साइन आउट",
  "hud.signingOut": "साइन आउट हो रहा है...",

  "clock.format": "दिन {day} · {time} · {phase}",
  "clock.phase.dawn": "भोर",
  "clock.phase.day": "दिन",
  "clock.phase.dusk": "सांझ",
  "clock.phase.night": "रात",

  "inventory.title": "बैग",
  "inventory.close": "बंद करें (I)",

  "build.title": "निर्माण मोड",
  "build.empty": "हॉटबार में रखने योग्य कोई वस्तु नहीं है।",
  "build.hint": "Q या क्लिक सामने वाले खाने में रखता है · B से बाहर निकलें",

  "chat.placeholder": "चैट के लिए Enter दबाएँ",
  "chat.unavailable": "चैट उपलब्ध नहीं है",
  "chat.ariaLabel": "चैट संदेश",

  "settings.title": "सेटिंग",
  "settings.open": "सेटिंग खोलें",
  "settings.close": "बंद करें (P)",
  "settings.language": "भाषा",
  "settings.languageHint": "केवल इस डिवाइस पर सहेजा जाता है।",
  "settings.sound": "ध्वनि",
  "settings.masterVolume": "मुख्य आवाज़",
  "settings.musicVolume": "संगीत की आवाज़",
  "settings.mute": "सारी ध्वनि बंद करें",
  "settings.soundHint": "पहली क्लिक के बाद ध्वनि शुरू होती है।",

  "item.wood": "लकड़ी",
  "item.stone": "पत्थर",
  "item.ore": "अयस्क",
  "item.fiber": "रेशा",
  "item.flower": "फूल",
  "item.wheat_seed": "गेहूँ का बीज",
  "item.wheat": "गेहूँ",
  "item.fence": "बाड़",
  "item.chest": "संदूक",
};
