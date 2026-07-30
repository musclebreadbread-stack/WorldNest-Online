import type { LocaleMessages } from "../index";

/** Simplified Chinese (中文). */
export const zh: LocaleMessages = {
  "common.loading": "加载中...",

  "landing.tagline": "在浏览器中畅玩的2D生活模拟MMO",
  "landing.subtitle": "探索自动生成的世界，建造家园，和朋友一起玩",
  "landing.play": "立即开始",

  "auth.signInSubtitle": "登录你的账号",
  "auth.signUpSubtitle": "创建新账号",
  "auth.usernameLabel": "用户名",
  "auth.usernamePlaceholder": "取一个用户名",
  "auth.emailLabel": "邮箱",
  "auth.emailPlaceholder": "you@example.com",
  "auth.passwordLabel": "密码",
  "auth.passwordPlaceholder": "请输入密码",
  "auth.signIn": "登录",
  "auth.signUp": "注册",
  "auth.submitting": "请稍候...",
  "auth.switchToSignUp": "还没有账号？注册",
  "auth.switchToSignIn": "已经有账号了？登录",
  "auth.genericError": "登录失败。请检查 Supabase 配置。",

  "game.loading": "正在加载游戏...",

  "hud.connected": "已连接",
  "hud.connecting": "连接中",
  "hud.disconnected": "已断开",
  "hud.playersOnline": "在线玩家：{count}",
  "hud.coordinates": "X: {x} Y: {y}",
  "hud.chunk": "区块：{chunkX}, {chunkY}",
  "hud.controls":
    "WASD / 方向键 · 1-8 快捷栏 · I 背包 · E 采集 / 种植 · B 建造 · M 地图 · P 设置 · Enter 聊天",
  "hud.health": "生命",
  "hud.energy": "体力",
  "hud.signOut": "退出登录",
  "hud.signingOut": "正在退出...",

  "clock.format": "第{day}天 · {time} · {phase}",
  "clock.phase.dawn": "黎明",
  "clock.phase.day": "白天",
  "clock.phase.dusk": "黄昏",
  "clock.phase.night": "夜晚",

  "inventory.title": "背包",
  "inventory.close": "关闭 (I)",

  "build.title": "建造模式",
  "build.empty": "快捷栏里没有可放置的物品。",
  "build.hint": "按 Q 或点击放置在面前的格子 · 按 B 退出",

  "chat.placeholder": "按 Enter 聊天",
  "chat.unavailable": "聊天暂不可用",
  "chat.ariaLabel": "聊天消息",

  "settings.title": "设置",
  "settings.open": "打开设置",
  "settings.close": "关闭 (P)",
  "settings.language": "语言",
  "settings.languageHint": "仅保存在此设备上。",
  "settings.sound": "声音",
  "settings.masterVolume": "总音量",
  "settings.musicVolume": "音乐音量",
  "settings.mute": "静音全部声音",
  "settings.soundHint": "首次点击后才会开始播放声音。",

  "touch.stick": "移动摇杆",
  "touch.interact": "使用",
  "touch.place": "放置",
  "touch.map": "地图",

  "item.wood": "木材",
  "item.stone": "石头",
  "item.ore": "矿石",
  "item.fiber": "纤维",
  "item.flower": "花朵",
  "item.wheat_seed": "小麦种子",
  "item.wheat": "小麦",
  "item.fence": "栅栏",
  "item.chest": "箱子",
};
