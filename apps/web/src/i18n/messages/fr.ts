import type { LocaleMessages } from "../index";

/** French (Français). */
export const fr: LocaleMessages = {
  "common.loading": "Chargement...",

  "landing.tagline": "Un MMO de simulation de vie en 2D directement dans le navigateur",
  "landing.subtitle": "Explore des mondes générés à l'infini, construis et joue avec tes amis",
  "landing.play": "Jouer maintenant",

  "auth.signInSubtitle": "Connecte-toi à ton compte",
  "auth.signUpSubtitle": "Crée un nouveau compte",
  "auth.usernameLabel": "Pseudo",
  "auth.usernamePlaceholder": "Choisis un pseudo",
  "auth.emailLabel": "Adresse e-mail",
  "auth.emailPlaceholder": "you@example.com",
  "auth.passwordLabel": "Mot de passe",
  "auth.passwordPlaceholder": "Saisis ton mot de passe",
  "auth.signIn": "Se connecter",
  "auth.signUp": "S'inscrire",
  "auth.submitting": "Un instant...",
  "auth.switchToSignUp": "Pas encore de compte ? Inscris-toi",
  "auth.switchToSignIn": "Tu as déjà un compte ? Connecte-toi",
  "auth.genericError": "Échec de la connexion. Vérifie la configuration Supabase.",

  "game.loading": "Chargement du jeu...",

  "hud.connected": "Connecté",
  "hud.connecting": "Connexion",
  "hud.disconnected": "Déconnecté",
  "hud.playersOnline": "Joueurs en ligne : {count}",
  "hud.coordinates": "X: {x} Y: {y}",
  "hud.chunk": "Zone : {chunkX}, {chunkY}",
  "hud.controls":
    "WASD / flèches · 1-8 barre rapide · I inventaire · E récolter / planter · B construire · M carte · P réglages · Entrée chat",
  "hud.health": "Vie",
  "hud.energy": "Énergie",
  "hud.signOut": "Se déconnecter",
  "hud.signingOut": "Déconnexion...",

  "clock.format": "Jour {day} · {time} · {phase}",
  "clock.phase.dawn": "aube",
  "clock.phase.day": "jour",
  "clock.phase.dusk": "crépuscule",
  "clock.phase.night": "nuit",

  "inventory.title": "Inventaire",
  "inventory.close": "Fermer (I)",

  "build.title": "Mode construction",
  "build.empty": "Aucun objet posable dans la barre rapide.",
  "build.hint": "Q ou clic pose sur la case en face · B pour quitter",

  "chat.placeholder": "Appuie sur Entrée pour discuter",
  "chat.unavailable": "Chat indisponible",
  "chat.ariaLabel": "Message de chat",

  "settings.title": "Réglages",
  "settings.open": "Ouvrir les réglages",
  "settings.close": "Fermer (P)",
  "settings.language": "Langue",
  "settings.languageHint": "Enregistré sur cet appareil uniquement.",
  "settings.sound": "Son",
  "settings.masterVolume": "Volume général",
  "settings.musicVolume": "Volume de la musique",
  "settings.mute": "Couper tous les sons",
  "settings.soundHint": "Le son démarre après votre premier clic.",

  "touch.stick": "Manette de déplacement",
  "touch.interact": "Utiliser",
  "touch.place": "Placer",
  "touch.map": "Carte",

  "item.wood": "Bois",
  "item.stone": "Pierre",
  "item.ore": "Minerai",
  "item.fiber": "Fibre",
  "item.flower": "Fleur",
  "item.wheat_seed": "Graine de blé",
  "item.wheat": "Blé",
  "item.fence": "Clôture",
  "item.chest": "Coffre",
};
