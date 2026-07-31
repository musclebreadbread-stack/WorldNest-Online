import type { LocaleMessages } from "../index";

/** Portuguese (Português). */
export const pt: LocaleMessages = {
  "common.loading": "Carregando...",

  "landing.tagline": "Um MMO de simulação de vida em 2D direto no navegador",
  "landing.subtitle":
    "Explore mundos gerados automaticamente, construa e jogue com amigos",
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
    "WASD / setas · 1-8 barra rápida · I inventário · E colher / plantar · B construir · M mapa · J missões · P ajustes · Esc fechar · Enter chat",
  "hud.health": "Vida",
  "hud.energy": "Energia",
  "hud.signOut": "Sair",
  "hud.signingOut": "Saindo...",
  "hud.coins": "{count} moedas",
  "hud.coinsAdjusted": "Saldo atualizado pelo servidor",

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

  "npc.pip.name": "Pip o jardineiro",
  "npc.juno.name": "Juno a lojista",
  "npc.ada.name": "Ada a exploradora",

  "npc.activity.home": "Em casa",
  "npc.activity.work": "Trabalhando",
  "npc.activity.market": "No mercado",
  "npc.activity.rest": "Descansando",

  "dialogue.close": "Despedir-se",
  "dialogue.hint": "Pressione 1-4 ou toque numa resposta",
  "dialogue.option.bye": "Até logo!",
  "dialogue.option.back": "Quero perguntar outra coisa",
  "dialogue.pip.greeting":
    "Bem-vindo ao WorldNest! Eu cuido dos canteiros de flores por aqui. Precisa de ajuda com algo?",
  "dialogue.pip.tips":
    "Fique ao lado de um pedaço de grama e pressione E para virar uma horta; pressione E de novo para semear. Volte algumas horas depois e o trigo estará pronto.",
  "dialogue.pip.option.tips": "Como começo uma horta?",
  "dialogue.juno.greeting":
    "Bem-vindo à minha lojinha! Compro tudo o que você coleta e vendo o que ainda falta.",
  "dialogue.juno.prices":
    "Pago um pouco menos do que cobro, é assim que a loja se mantém. Mesmo assim, colete bastante e você sai ganhando.",
  "dialogue.juno.option.shop": "Mostre o que você tem",
  "dialogue.juno.option.prices": "Como são os seus preços?",
  "dialogue.ada.greeting":
    "Olá, exploradora! Eu mantenho uma lista de tarefas que a vila precisa.",
  "dialogue.ada.quests": "Escolha uma tarefa e eu anoto o seu nome ao lado.",
  "dialogue.ada.report": "Já terminou? Diga qual tarefa você fez.",
  "dialogue.ada.option.quests": "O que precisa ser feito?",
  "dialogue.ada.option.report": "Terminei uma tarefa",
  "dialogue.ada.option.wood": "Juntar lenha",
  "dialogue.ada.option.fence": "Cercar o jardim",
  "dialogue.ada.option.greet": "Cumprimentar o Pip",

  "touch.stick": "Alavanca de movimento",
  "touch.interact": "Usar",
  "touch.place": "Colocar",
  "touch.map": "Mapa",

  "shop.title": "Loja",
  "shop.close": "Fechar (Esc)",
  "shop.hint": "Preços fixos. A loja sempre paga um pouco menos do que cobra.",
  "shop.item": "Objeto",
  "shop.held": "você tem {count}",
  "shop.buy": "Comprar",
  "shop.sell": "Vender",
  "shop.buyQuantity": "Comprar {quantity}",
  "shop.sellQuantity": "Vender {quantity}",
  "shop.buyPrice": "Custa {coins} moedas",
  "shop.sellPrice": "Rende {coins} moedas",

  "quest.title": "Diário de missões",
  "quest.close": "Fechar (J)",
  "quest.empty": "Ainda sem tarefas. A Ada tem a lista da aldeia, vá falar com ela.",
  "quest.progress": "{current} / {target}",
  "quest.state.available": "Oferecida",
  "quest.state.active": "Em andamento",
  "quest.state.completed": "Concluída",
  "quest.turnIn": "Entregar",
  "quest.tracking": "Tarefa atual",
  "quest.collect_wood.title": "Lenha para a aldeia",
  "quest.collect_wood.description": "Junte 5 de madeira e mostre à Ada.",
  "quest.build_fence.title": "Cercar a horta",
  "quest.build_fence.description": "Coloque 2 cercas onde quiser e avise a Ada.",
  "quest.greet_pip.title": "Diga olá ao Pip",
  "quest.greet_pip.description":
    "O jardineiro Pip adora visitas. Vá conversar com ele.",

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
