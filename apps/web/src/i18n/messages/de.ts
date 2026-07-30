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

  "npc.pip.name": "Pip der Gärtner",
  "npc.juno.name": "Juno die Händlerin",
  "npc.ada.name": "Ada die Entdeckerin",

  "dialogue.close": "Verabschieden",
  "dialogue.hint": "Drücke 1-4 oder tippe eine Antwort an",
  "dialogue.option.bye": "Bis bald!",
  "dialogue.option.back": "Ich möchte etwas anderes fragen",
  "dialogue.pip.greeting":
    "Willkommen in WorldNest! Ich kümmere mich hier um die Blumenbeete. Kann ich dir helfen?",
  "dialogue.pip.tips":
    "Stell dich vor ein Stück Wiese und drücke E, dann wird daraus ein Feld; noch einmal E und du säst deine Samen. Komm in ein paar Stunden wieder, dann ist der Weizen reif.",
  "dialogue.pip.option.tips": "Wie fange ich mit dem Ackerbau an?",
  "dialogue.juno.greeting":
    "Willkommen in meinem kleinen Laden! Ich kaufe alles, was du sammelst, und verkaufe, was dir fehlt.",
  "dialogue.juno.prices":
    "Ich zahle etwas weniger, als ich verlange, sonst könnte der Laden nicht bestehen. Sammle genug, dann bleibt für dich trotzdem etwas übrig.",
  "dialogue.juno.option.shop": "Zeig mir deine Waren",
  "dialogue.juno.option.prices": "Wie kommen deine Preise zustande?",
  "dialogue.ada.greeting":
    "Hallo, Entdeckerin! Ich führe eine Liste mit Arbeiten, die im Dorf anfallen.",
  "dialogue.ada.quests": "Wähle eine Aufgabe, dann schreibe ich deinen Namen daneben.",
  "dialogue.ada.report": "Schon fertig? Sag mir, welche Aufgabe du erledigt hast.",
  "dialogue.ada.option.quests": "Was ist zu tun?",
  "dialogue.ada.option.report": "Ich habe eine Aufgabe erledigt",
  "dialogue.ada.option.wood": "Brennholz sammeln",
  "dialogue.ada.option.fence": "Den Garten einzäunen",
  "dialogue.ada.option.greet": "Pip begrüßen",

  "touch.stick": "Bewegungsstick",
  "touch.interact": "Benutzen",
  "touch.place": "Platzieren",
  "touch.map": "Karte",

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
