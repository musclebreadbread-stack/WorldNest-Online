import type { LocaleMessages } from "../index";

/** Japanese (日本語). */
export const ja: LocaleMessages = {
  "common.loading": "読み込み中...",

  "landing.tagline": "ブラウザで遊べる2D生活シミュレーションMMO",
  "landing.subtitle": "自動生成される世界を探検し、建てて、友だちと遊ぼう",
  "landing.play": "今すぐプレイ",

  "auth.signInSubtitle": "アカウントにログイン",
  "auth.signUpSubtitle": "新しいアカウントを作成",
  "auth.usernameLabel": "ユーザー名",
  "auth.usernamePlaceholder": "ユーザー名を決めてください",
  "auth.emailLabel": "メールアドレス",
  "auth.emailPlaceholder": "you@example.com",
  "auth.passwordLabel": "パスワード",
  "auth.passwordPlaceholder": "パスワードを入力してください",
  "auth.signIn": "ログイン",
  "auth.signUp": "新規登録",
  "auth.submitting": "しばらくお待ちください...",
  "auth.switchToSignUp": "アカウントをお持ちでない方は新規登録",
  "auth.switchToSignIn": "すでにアカウントをお持ちの方はログイン",
  "auth.genericError": "認証に失敗しました。Supabaseの設定を確認してください。",

  "game.loading": "ゲームを読み込み中...",

  "hud.connected": "接続済み",
  "hud.connecting": "接続中",
  "hud.disconnected": "切断",
  "hud.playersOnline": "オンラインのプレイヤー: {count}人",
  "hud.coordinates": "X: {x} Y: {y}",
  "hud.chunk": "チャンク: {chunkX}, {chunkY}",
  "hud.controls":
    "WASD / 矢印キー · 1-8 ホットバー · I 持ち物 · E 収穫 / 種まき · B 建築 · M 地図 · P 設定 · Enter チャット",
  "hud.health": "体力",
  "hud.energy": "気力",
  "hud.signOut": "ログアウト",
  "hud.signingOut": "ログアウト中...",

  "clock.format": "{day}日目 · {time} · {phase}",
  "clock.phase.dawn": "夜明け",
  "clock.phase.day": "昼",
  "clock.phase.dusk": "夕暮れ",
  "clock.phase.night": "夜",

  "inventory.title": "持ち物",
  "inventory.close": "閉じる (I)",

  "build.title": "建築モード",
  "build.empty": "ホットバーに設置できるアイテムがありません。",
  "build.hint": "Q またはクリックで正面のマスに設置 · B で終了",

  "chat.placeholder": "Enter を押してチャット",
  "chat.unavailable": "チャットを利用できません",
  "chat.ariaLabel": "チャットメッセージ",

  "settings.title": "設定",
  "settings.open": "設定を開く",
  "settings.close": "閉じる (P)",
  "settings.language": "言語",
  "settings.languageHint": "この端末にのみ保存されます。",
  "settings.sound": "サウンド",
  "settings.masterVolume": "全体の音量",
  "settings.musicVolume": "音楽の音量",
  "settings.mute": "すべての音を消す",
  "settings.soundHint": "最初のクリックの後に音が鳴り始めます。",

  "item.wood": "木材",
  "item.stone": "石",
  "item.ore": "鉱石",
  "item.fiber": "繊維",
  "item.flower": "花",
  "item.wheat_seed": "小麦の種",
  "item.wheat": "小麦",
  "item.fence": "フェンス",
  "item.chest": "チェスト",
};
