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
  "hud.coins": "{count} monedas",

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

  "npc.pip.name": "Pip el jardinero",
  "npc.juno.name": "Juno la tendera",
  "npc.ada.name": "Ada la exploradora",

  "dialogue.close": "Despedirse",
  "dialogue.hint": "Pulsa 1-4 o toca una respuesta",
  "dialogue.option.bye": "¡Hasta pronto!",
  "dialogue.option.back": "Quiero preguntar otra cosa",
  "dialogue.pip.greeting":
    "¡Bienvenido a WorldNest! Yo cuido los parterres de por aquí. ¿Te ayudo con algo?",
  "dialogue.pip.tips":
    "Ponte junto a un trozo de hierba y pulsa E para convertirlo en un huerto; pulsa E otra vez para sembrar. Vuelve en unas horas y el trigo estará listo.",
  "dialogue.pip.option.tips": "¿Cómo empiezo un huerto?",
  "dialogue.juno.greeting":
    "¡Bienvenido a mi tiendita! Compro todo lo que recolectas y vendo lo que te falte.",
  "dialogue.juno.prices":
    "Pago un poco menos de lo que cobro, así sigue abierta la tienda. Aun así, si recolectas bastante saldrás ganando.",
  "dialogue.juno.option.shop": "Muéstrame lo que tienes",
  "dialogue.juno.option.prices": "¿Cómo funcionan tus precios?",
  "dialogue.ada.greeting":
    "¡Hola, exploradora! Llevo una lista de tareas que hacen falta en el pueblo.",
  "dialogue.ada.quests": "Elige una tarea y apunto tu nombre al lado.",
  "dialogue.ada.report": "¿Ya terminaste? Dime cuál hiciste.",
  "dialogue.ada.option.quests": "¿Qué hace falta?",
  "dialogue.ada.option.report": "He terminado una tarea",
  "dialogue.ada.option.wood": "Recoger leña",
  "dialogue.ada.option.fence": "Cercar el jardín",
  "dialogue.ada.option.greet": "Saludar a Pip",

  "touch.stick": "Palanca de movimiento",
  "touch.interact": "Usar",
  "touch.place": "Colocar",
  "touch.map": "Mapa",

  "shop.title": "Tienda",
  "shop.close": "Cerrar (Esc)",
  "shop.hint": "Precios fijos. La tienda siempre paga un poco menos de lo que cobra.",
  "shop.item": "Artículo",
  "shop.held": "tienes {count}",
  "shop.buy": "Comprar",
  "shop.sell": "Vender",
  "shop.buyQuantity": "Comprar {quantity}",
  "shop.sellQuantity": "Vender {quantity}",
  "shop.buyPrice": "Cuesta {coins} monedas",
  "shop.sellPrice": "Paga {coins} monedas",

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
