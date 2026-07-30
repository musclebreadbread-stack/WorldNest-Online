import type { LocaleMessages } from "../index";

/** German (Deutsch). */
export const de: LocaleMessages = {
  "common.loading": "Wird geladen...",

  "landing.tagline": "Ein 2D-Lebenssimulations-MMO direkt im Browser",
  "landing.subtitle": "Erkunde zufällig erzeugte Welten, baue und spiele mit Freunden",
  "landing.play": "Jetzt spielen",

  "auth.signInSubtitle": "Melde dich bei deinem Konto an",
  "auth.signUpSubtitle": "Erstelle ein neues Konto",
  "auth.usernameLabel": "Benutzername",
  "auth.usernamePlaceholder": "Wähle einen Benutzernamen",
  "auth.emailLabel": "E-Mail",
  "auth.emailPlaceholder": "you@example.com",
  "auth.passwordLabel": "Passwort",
  "auth.passwordPlaceholder": "Gib dein Passwort ein",
  "auth.signIn": "Anmelden",
  "auth.signUp": "Registrieren",
  "auth.submitting": "Bitte warten...",
  "auth.switchToSignUp": "Noch kein Konto? Registrieren",
  "auth.switchToSignIn": "Schon ein Konto? Anmelden",
  "auth.genericError": "Anmeldung fehlgeschlagen. Prüfe die Supabase-Konfiguration.",

  "game.loading": "Spiel wird geladen...",

  "hud.connected": "Verbunden",
  "hud.connecting": "Verbinde",
  "hud.disconnected": "Getrennt",
  "hud.playersOnline": "Spieler online: {count}",
  "hud.coordinates": "X: {x} Y: {y}",
  "hud.chunk": "Abschnitt: {chunkX}, {chunkY}",
  "hud.controls":
    "WASD / Pfeiltasten · 1-8 Schnellleiste · I Inventar · E ernten / pflanzen · B bauen · M Karte · P Einstellungen · Enter Chat",
  "hud.health": "Leben",
  "hud.energy": "Energie",
  "hud.signOut": "Abmelden",
  "hud.signingOut": "Wird abgemeldet...",

  "clock.format": "Tag {day} · {time} · {phase}",
  "clock.phase.dawn": "Morgengrauen",
  "clock.phase.day": "Tag",
  "clock.phase.dusk": "Abenddämmerung",
  "clock.phase.night": "Nacht",

  "inventory.title": "Inventar",
  "inventory.close": "Schließen (I)",

  "build.title": "Baumodus",
  "build.empty": "Keine platzierbaren Gegenstände in der Schnellleiste.",
  "build.hint": "Q oder Klick setzt auf das Feld davor · B beendet",

  "chat.placeholder": "Enter drücken, um zu chatten",
  "chat.unavailable": "Chat nicht verfügbar",
  "chat.ariaLabel": "Chatnachricht",

  "settings.title": "Einstellungen",
  "settings.open": "Einstellungen öffnen",
  "settings.close": "Schließen (P)",
  "settings.language": "Sprache",
  "settings.languageHint": "Nur auf diesem Gerät gespeichert.",
  "settings.sound": "Ton",
  "settings.masterVolume": "Gesamtlautstärke",
  "settings.musicVolume": "Musiklautstärke",
  "settings.mute": "Alle Töne stummschalten",
  "settings.soundHint": "Der Ton startet nach dem ersten Klick.",

  "item.wood": "Holz",
  "item.stone": "Stein",
  "item.ore": "Erz",
  "item.fiber": "Faser",
  "item.flower": "Blume",
  "item.wheat_seed": "Weizensamen",
  "item.wheat": "Weizen",
  "item.fence": "Zaun",
  "item.chest": "Kiste",
};
