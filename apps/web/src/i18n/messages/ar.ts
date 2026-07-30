import type { LocaleMessages } from "../index";

/**
 * Arabic (العربية). Right to left: `RTL_LOCALES` puts `dir="rtl"` on `<html>`,
 * and the HUD uses logical positioning so the corner panels mirror.
 */
export const ar: LocaleMessages = {
  "common.loading": "جارٍ التحميل...",

  "landing.tagline": "لعبة محاكاة حياة ثنائية الأبعاد جماعية تعمل في المتصفح",
  "landing.subtitle": "استكشف عوالم تُنشأ تلقائيًا، وابنِ، والعب مع أصدقائك",
  "landing.play": "ابدأ اللعب",

  "auth.signInSubtitle": "سجّل الدخول إلى حسابك",
  "auth.signUpSubtitle": "أنشئ حسابًا جديدًا",
  "auth.usernameLabel": "اسم المستخدم",
  "auth.usernamePlaceholder": "اختر اسم مستخدم",
  "auth.emailLabel": "البريد الإلكتروني",
  "auth.emailPlaceholder": "you@example.com",
  "auth.passwordLabel": "كلمة المرور",
  "auth.passwordPlaceholder": "أدخل كلمة المرور",
  "auth.signIn": "تسجيل الدخول",
  "auth.signUp": "إنشاء حساب",
  "auth.submitting": "انتظر لحظة...",
  "auth.switchToSignUp": "ليس لديك حساب؟ أنشئ حسابًا",
  "auth.switchToSignIn": "لديك حساب بالفعل؟ سجّل الدخول",
  "auth.genericError": "فشل تسجيل الدخول. تحقق من إعدادات Supabase.",

  "game.loading": "جارٍ تحميل اللعبة...",

  "hud.connected": "متصل",
  "hud.connecting": "يتم الاتصال",
  "hud.disconnected": "غير متصل",
  "hud.playersOnline": "اللاعبون المتصلون: {count}",
  "hud.coordinates": "X: {x} Y: {y}",
  "hud.chunk": "القطعة: {chunkX}, {chunkY}",
  "hud.controls":
    "WASD / الأسهم · 1-8 الشريط السريع · I الحقيبة · E الحصاد / الزراعة · B البناء · M الخريطة · P الإعدادات · Enter الدردشة",
  "hud.health": "الصحة",
  "hud.energy": "الطاقة",
  "hud.signOut": "تسجيل الخروج",
  "hud.signingOut": "جارٍ تسجيل الخروج...",

  "clock.format": "اليوم {day} · {time} · {phase}",
  "clock.phase.dawn": "الفجر",
  "clock.phase.day": "النهار",
  "clock.phase.dusk": "الغروب",
  "clock.phase.night": "الليل",

  "inventory.title": "الحقيبة",
  "inventory.close": "إغلاق (I)",

  "build.title": "وضع البناء",
  "build.empty": "لا توجد عناصر قابلة للوضع في الشريط السريع.",
  "build.hint": "اضغط Q أو انقر للوضع على المربع أمامك · B للخروج",

  "chat.placeholder": "اضغط Enter للدردشة",
  "chat.unavailable": "الدردشة غير متاحة",
  "chat.ariaLabel": "رسالة دردشة",

  "settings.title": "الإعدادات",
  "settings.open": "فتح الإعدادات",
  "settings.close": "إغلاق (P)",
  "settings.language": "اللغة",
  "settings.languageHint": "يُحفظ على هذا الجهاز فقط.",
  "settings.sound": "الصوت",
  "settings.masterVolume": "مستوى الصوت العام",
  "settings.musicVolume": "مستوى صوت الموسيقى",
  "settings.mute": "كتم جميع الأصوات",
  "settings.soundHint": "يبدأ الصوت بعد أول نقرة لك.",

  "item.wood": "خشب",
  "item.stone": "حجر",
  "item.ore": "خام",
  "item.fiber": "ألياف",
  "item.flower": "زهرة",
  "item.wheat_seed": "بذور قمح",
  "item.wheat": "قمح",
  "item.fence": "سياج",
  "item.chest": "صندوق",
};
