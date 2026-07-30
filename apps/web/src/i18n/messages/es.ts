import type { LocaleMessages } from "../index";

/** Spanish (Español). */
export const es: LocaleMessages = {
  "common.loading": "Cargando...",

  "landing.tagline": "Un MMO de simulación de vida en 2D para tu navegador",
  "landing.subtitle": "Explora mundos generados al azar, construye y juega con amigos",
  "landing.play": "Jugar ahora",

  "auth.signInSubtitle": "Inicia sesión en tu cuenta",
  "auth.signUpSubtitle": "Crea una cuenta nueva",
  "auth.usernameLabel": "Nombre de usuario",
  "auth.usernamePlaceholder": "Elige un nombre de usuario",
  "auth.emailLabel": "Correo electrónico",
  "auth.emailPlaceholder": "you@example.com",
  "auth.passwordLabel": "Contraseña",
  "auth.passwordPlaceholder": "Escribe tu contraseña",
  "auth.signIn": "Iniciar sesión",
  "auth.signUp": "Registrarse",
  "auth.submitting": "Espera un momento...",
  "auth.switchToSignUp": "¿No tienes cuenta? Regístrate",
  "auth.switchToSignIn": "¿Ya tienes cuenta? Inicia sesión",
  "auth.genericError": "No se pudo iniciar sesión. Revisa la configuración de Supabase.",

  "game.loading": "Cargando el juego...",

  "hud.connected": "Conectado",
  "hud.connecting": "Conectando",
  "hud.disconnected": "Sin conexión",
  "hud.playersOnline": "Jugadores en línea: {count}",
  "hud.coordinates": "X: {x} Y: {y}",
  "hud.chunk": "Sector: {chunkX}, {chunkY}",
  "hud.controls":
    "WASD / flechas · 1-8 acceso rápido · I inventario · E recoger / plantar · B construir · M mapa · P ajustes · Enter chat",
  "hud.health": "Salud",
  "hud.energy": "Energía",
  "hud.signOut": "Cerrar sesión",
  "hud.signingOut": "Cerrando sesión...",

  "clock.format": "Día {day} · {time} · {phase}",
  "clock.phase.dawn": "amanecer",
  "clock.phase.day": "día",
  "clock.phase.dusk": "atardecer",
  "clock.phase.night": "noche",

  "inventory.title": "Inventario",
  "inventory.close": "Cerrar (I)",

  "build.title": "Modo construcción",
  "build.empty": "No hay objetos colocables en el acceso rápido.",
  "build.hint": "Q o clic coloca en la casilla de enfrente · B sale",

  "chat.placeholder": "Pulsa Enter para chatear",
  "chat.unavailable": "Chat no disponible",
  "chat.ariaLabel": "Mensaje de chat",

  "settings.title": "Ajustes",
  "settings.open": "Abrir ajustes",
  "settings.close": "Cerrar (P)",
  "settings.language": "Idioma",
  "settings.languageHint": "Se guarda solo en este dispositivo.",
  "settings.sound": "Sonido",
  "settings.masterVolume": "Volumen general",
  "settings.musicVolume": "Volumen de la música",
  "settings.mute": "Silenciar todo el sonido",
  "settings.soundHint": "El sonido empieza tras tu primer clic.",

  "touch.stick": "Palanca de movimiento",
  "touch.interact": "Usar",
  "touch.place": "Colocar",
  "touch.map": "Mapa",

  "item.wood": "Madera",
  "item.stone": "Piedra",
  "item.ore": "Mineral",
  "item.fiber": "Fibra",
  "item.flower": "Flor",
  "item.wheat_seed": "Semilla de trigo",
  "item.wheat": "Trigo",
  "item.fence": "Valla",
  "item.chest": "Cofre",
};
