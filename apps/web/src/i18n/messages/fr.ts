import type { LocaleMessages } from "../index";

/** French (Français). */
export const fr: LocaleMessages = {
  "common.loading": "Chargement...",

  "landing.tagline": "Un MMO de simulation de vie en 2D directement dans le navigateur",
  "landing.subtitle":
    "Explore des mondes générés à l'infini, construis et joue avec tes amis",
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
    "WASD / flèches · 1-8 barre rapide · I inventaire · E récolter / planter · B construire · M carte · J quêtes · P réglages · Esc fermer · Entrée chat",
  "hud.health": "Vie",
  "hud.energy": "Énergie",
  "hud.signOut": "Se déconnecter",
  "hud.signingOut": "Déconnexion...",
  "hud.coins": "{count} pièces",
  "hud.coinsAdjusted": "Solde mis à jour par le serveur",

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

  "npc.pip.name": "Pip le jardinier",
  "npc.juno.name": "Juno la commerçante",
  "npc.ada.name": "Ada l'exploratrice",

  "dialogue.close": "Prendre congé",
  "dialogue.hint": "Appuie sur 1-4 ou touche une réponse",
  "dialogue.option.bye": "À bientôt !",
  "dialogue.option.back": "J'ai une autre question",
  "dialogue.pip.greeting":
    "Bienvenue dans WorldNest ! Je m'occupe des massifs de fleurs du coin. Je peux t'aider ?",
  "dialogue.pip.tips":
    "Place-toi devant un carré d'herbe et appuie sur E pour en faire un champ, puis encore une fois pour semer. Reviens dans quelques heures et le blé sera mûr.",
  "dialogue.pip.option.tips": "Comment démarrer un potager ?",
  "dialogue.juno.greeting":
    "Bienvenue dans ma petite boutique ! J'achète ce que tu récoltes et je vends ce qui te manque.",
  "dialogue.juno.prices":
    "Je paie un peu moins que je ne vends, c'est ce qui fait vivre la boutique. Récolte beaucoup et tu resteras gagnant.",
  "dialogue.juno.option.shop": "Montre-moi ta marchandise",
  "dialogue.juno.option.prices": "Comment fixes-tu tes prix ?",
  "dialogue.ada.greeting":
    "Salut, exploratrice ! Je tiens la liste des travaux à faire au village.",
  "dialogue.ada.quests": "Choisis un travail et j'inscris ton nom à côté.",
  "dialogue.ada.report": "C'est terminé ? Dis-moi lequel tu as fait.",
  "dialogue.ada.option.quests": "Qu'y a-t-il à faire ?",
  "dialogue.ada.option.report": "J'ai terminé un travail",
  "dialogue.ada.option.wood": "Ramasser du bois de chauffage",
  "dialogue.ada.option.fence": "Clôturer le jardin",
  "dialogue.ada.option.greet": "Aller saluer Pip",

  "touch.stick": "Manette de déplacement",
  "touch.interact": "Utiliser",
  "touch.place": "Placer",
  "touch.map": "Carte",

  "shop.title": "Boutique",
  "shop.close": "Fermer (Esc)",
  "shop.hint": "Prix fixes. La boutique paie toujours un peu moins qu'elle ne demande.",
  "shop.item": "Objet",
  "shop.held": "tu en as {count}",
  "shop.buy": "Acheter",
  "shop.sell": "Vendre",
  "shop.buyQuantity": "Acheter {quantity}",
  "shop.sellQuantity": "Vendre {quantity}",
  "shop.buyPrice": "Coûte {coins} pièces",
  "shop.sellPrice": "Rapporte {coins} pièces",

  "quest.title": "Journal des quêtes",
  "quest.close": "Fermer (J)",
  "quest.empty":
    "Aucune tâche pour l'instant. Ada tient la liste du village, va lui demander.",
  "quest.progress": "{current} / {target}",
  "quest.state.available": "Proposée",
  "quest.state.active": "En cours",
  "quest.state.completed": "Terminée",
  "quest.turnIn": "Rendre",
  "quest.tracking": "Tâche en cours",
  "quest.collect_wood.title": "Du bois pour le village",
  "quest.collect_wood.description": "Récolte 5 bois et montre-les à Ada.",
  "quest.build_fence.title": "Clôturer le jardin",
  "quest.build_fence.description": "Pose 2 clôtures où tu veux, puis préviens Ada.",
  "quest.greet_pip.title": "Dis bonjour à Pip",
  "quest.greet_pip.description": "Pip le jardinier adore la visite. Va lui parler.",

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
