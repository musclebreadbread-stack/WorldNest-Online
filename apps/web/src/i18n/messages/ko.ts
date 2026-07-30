import type { LocaleMessages } from "../index";

/** Korean (한국어). */
export const ko: LocaleMessages = {
  "common.loading": "불러오는 중...",

  "landing.tagline": "브라우저에서 바로 즐기는 2D 생활 시뮬레이션 MMO",
  "landing.subtitle": "끝없이 생성되는 세계를 탐험하고, 건설하고, 친구와 함께 플레이하세요",
  "landing.play": "지금 플레이",

  "auth.signInSubtitle": "계정에 로그인하세요",
  "auth.signUpSubtitle": "새 계정을 만드세요",
  "auth.usernameLabel": "닉네임",
  "auth.usernamePlaceholder": "닉네임을 정해 주세요",
  "auth.emailLabel": "이메일",
  "auth.emailPlaceholder": "you@example.com",
  "auth.passwordLabel": "비밀번호",
  "auth.passwordPlaceholder": "비밀번호를 입력하세요",
  "auth.signIn": "로그인",
  "auth.signUp": "회원가입",
  "auth.submitting": "잠시만 기다려 주세요...",
  "auth.switchToSignUp": "계정이 없으신가요? 회원가입",
  "auth.switchToSignIn": "이미 계정이 있으신가요? 로그인",
  "auth.genericError": "로그인에 실패했습니다. Supabase 설정을 확인해 주세요.",

  "game.loading": "게임을 불러오는 중...",

  "hud.connected": "연결됨",
  "hud.connecting": "연결 중",
  "hud.disconnected": "연결 끊김",
  "hud.playersOnline": "접속 중인 플레이어: {count}명",
  "hud.coordinates": "X: {x} Y: {y}",
  "hud.chunk": "청크: {chunkX}, {chunkY}",
  "hud.controls":
    "WASD / 방향키 · 1-8 퀵슬롯 · I 인벤토리 · E 수확 / 심기 · B 건설 · M 지도 · P 설정 · Enter 채팅",
  "hud.health": "체력",
  "hud.energy": "기력",
  "hud.signOut": "로그아웃",
  "hud.signingOut": "로그아웃 중...",

  "clock.format": "{day}일차 · {time} · {phase}",
  "clock.phase.dawn": "새벽",
  "clock.phase.day": "낮",
  "clock.phase.dusk": "저녁",
  "clock.phase.night": "밤",

  "inventory.title": "인벤토리",
  "inventory.close": "닫기 (I)",

  "build.title": "건설 모드",
  "build.empty": "퀵슬롯에 설치할 수 있는 아이템이 없습니다.",
  "build.hint": "Q 또는 클릭으로 바라보는 칸에 설치 · B 로 종료",

  "chat.placeholder": "Enter 를 눌러 채팅",
  "chat.unavailable": "채팅을 사용할 수 없습니다",
  "chat.ariaLabel": "채팅 메시지",

  "settings.title": "설정",
  "settings.open": "설정 열기",
  "settings.close": "닫기 (P)",
  "settings.language": "언어",
  "settings.languageHint": "이 기기에만 저장됩니다.",
  "settings.sound": "소리",
  "settings.masterVolume": "전체 음량",
  "settings.musicVolume": "음악 음량",
  "settings.mute": "모든 소리 끄기",
  "settings.soundHint": "첫 클릭 후에 소리가 시작됩니다.",

  "touch.stick": "이동 스틱",
  "touch.interact": "사용",
  "touch.place": "설치",
  "touch.map": "지도",

  "item.wood": "나무",
  "item.stone": "돌",
  "item.ore": "광석",
  "item.fiber": "섬유",
  "item.flower": "꽃",
  "item.wheat_seed": "밀 씨앗",
  "item.wheat": "밀",
  "item.fence": "울타리",
  "item.chest": "상자",
};
