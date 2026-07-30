import type { LocaleMessages } from "../index";

/** Portuguese (Português). */
export const pt: LocaleMessages = {
  "common.loading": "Carregando...",

  "landing.tagline": "Um MMO de simulação de vida em 2D direto no navegador",
  "landing.subtitle": "Explore mundos gerados automaticamente, construa e jogue com amigos",
  "landing.play": "Jogar agora",

  "auth.signInSubtitle": "Entre na sua conta",
  "auth.signUpSubtitle": "Crie uma conta nova",
  "auth.usernameLabel": "Nome de usuário",
  "auth.usernamePlaceholder": "Escolha um nome de usuário",
  "auth.emailLabel": "E-mail",
  "auth.emailPlaceholder": "you@example.com",
  "auth.passwordLabel": "Senha",
  "auth.passwordPlaceholder": "Digite sua senha",
  "auth.signIn": "Entrar",
  "auth.signUp": "Criar conta",
  "auth.submitting": "Aguarde um momento...",
  "auth.switchToSignUp": "Não tem conta? Crie uma",
  "auth.switchToSignIn": "Já tem conta? Entre",
  "auth.genericError": "Não foi possível entrar. Verifique a configuração do Supabase.",

  "game.loading": "Carregando o jogo...",

  "hud.connected": "Conectado",
  "hud.connecting": "Conectando",
  "hud.disconnected": "Desconectado",
  "hud.playersOnline": "Jogadores online: {count}",
  "hud.coordinates": "X: {x} Y: {y}",
  "hud.chunk": "Bloco: {chunkX}, {chunkY}",
  "hud.controls":
    "WASD / setas · 1-8 barra rápida · I inventário · E colher / plantar · B construir · M mapa · P ajustes · Enter chat",
  "hud.health": "Vida",
  "hud.energy": "Energia",
  "hud.signOut": "Sair",
  "hud.signingOut": "Saindo...",

  "clock.format": "Dia {day} · {time} · {phase}",
  "clock.phase.dawn": "amanhecer",
  "clock.phase.day": "dia",
  "clock.phase.dusk": "anoitecer",
  "clock.phase.night": "noite",

  "inventory.title": "Inventário",
  "inventory.close": "Fechar (I)",

  "build.title": "Modo construção",
  "build.empty": "Nenhum item para colocar na barra rápida.",
  "build.hint": "Q ou clique coloca no quadrado à frente · B sai",

  "chat.placeholder": "Aperte Enter para conversar",
  "chat.unavailable": "Chat indisponível",
  "chat.ariaLabel": "Mensagem do chat",

  "settings.title": "Ajustes",
  "settings.open": "Abrir ajustes",
  "settings.close": "Fechar (P)",
  "settings.language": "Idioma",
  "settings.languageHint": "Salvo apenas neste dispositivo.",
  "settings.sound": "Som",
  "settings.masterVolume": "Volume geral",
  "settings.musicVolume": "Volume da música",
  "settings.mute": "Silenciar todos os sons",
  "settings.soundHint": "O som começa após o seu primeiro clique.",

  "item.wood": "Madeira",
  "item.stone": "Pedra",
  "item.ore": "Minério",
  "item.fiber": "Fibra",
  "item.flower": "Flor",
  "item.wheat_seed": "Semente de trigo",
  "item.wheat": "Trigo",
  "item.fence": "Cerca",
  "item.chest": "Baú",
};
