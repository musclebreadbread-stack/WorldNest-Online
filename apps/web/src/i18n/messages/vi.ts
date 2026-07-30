import type { LocaleMessages } from "../index";

/** Vietnamese (Tiếng Việt). */
export const vi: LocaleMessages = {
  "common.loading": "Đang tải...",

  "landing.tagline": "Game MMO mô phỏng cuộc sống 2D chơi ngay trên trình duyệt",
  "landing.subtitle": "Khám phá thế giới tự sinh, xây dựng và chơi cùng bạn bè",
  "landing.play": "Chơi ngay",

  "auth.signInSubtitle": "Đăng nhập vào tài khoản của bạn",
  "auth.signUpSubtitle": "Tạo tài khoản mới",
  "auth.usernameLabel": "Tên người chơi",
  "auth.usernamePlaceholder": "Chọn một tên người chơi",
  "auth.emailLabel": "Địa chỉ email",
  "auth.emailPlaceholder": "you@example.com",
  "auth.passwordLabel": "Mật khẩu",
  "auth.passwordPlaceholder": "Nhập mật khẩu của bạn",
  "auth.signIn": "Đăng nhập",
  "auth.signUp": "Đăng ký",
  "auth.submitting": "Vui lòng đợi...",
  "auth.switchToSignUp": "Chưa có tài khoản? Đăng ký",
  "auth.switchToSignIn": "Đã có tài khoản? Đăng nhập",
  "auth.genericError": "Đăng nhập thất bại. Hãy kiểm tra cấu hình Supabase.",

  "game.loading": "Đang tải trò chơi...",

  "hud.connected": "Đã kết nối",
  "hud.connecting": "Đang kết nối",
  "hud.disconnected": "Đã ngắt kết nối",
  "hud.playersOnline": "Người chơi trực tuyến: {count}",
  "hud.coordinates": "X: {x} Y: {y}",
  "hud.chunk": "Vùng: {chunkX}, {chunkY}",
  "hud.controls":
    "WASD / mũi tên · 1-8 thanh nhanh · I túi đồ · E thu hoạch / trồng · B xây · M bản đồ · P cài đặt · Enter trò chuyện",
  "hud.health": "Sức khỏe",
  "hud.energy": "Năng lượng",
  "hud.signOut": "Đăng xuất",
  "hud.signingOut": "Đang đăng xuất...",

  "clock.format": "Ngày {day} · {time} · {phase}",
  "clock.phase.dawn": "bình minh",
  "clock.phase.day": "ban ngày",
  "clock.phase.dusk": "hoàng hôn",
  "clock.phase.night": "ban đêm",

  "inventory.title": "Túi đồ",
  "inventory.close": "Đóng (I)",

  "build.title": "Chế độ xây dựng",
  "build.empty": "Không có vật phẩm nào có thể đặt trong thanh nhanh.",
  "build.hint": "Q hoặc bấm chuột để đặt vào ô phía trước · B để thoát",

  "chat.placeholder": "Nhấn Enter để trò chuyện",
  "chat.unavailable": "Không dùng được trò chuyện",
  "chat.ariaLabel": "Tin nhắn trò chuyện",

  "settings.title": "Cài đặt",
  "settings.open": "Mở cài đặt",
  "settings.close": "Đóng (P)",
  "settings.language": "Ngôn ngữ",
  "settings.languageHint": "Chỉ lưu trên thiết bị này.",

  "item.wood": "Gỗ",
  "item.stone": "Đá",
  "item.ore": "Quặng",
  "item.fiber": "Sợi",
  "item.flower": "Hoa",
  "item.wheat_seed": "Hạt lúa mì",
  "item.wheat": "Lúa mì",
  "item.fence": "Hàng rào",
  "item.chest": "Hòm",
};
