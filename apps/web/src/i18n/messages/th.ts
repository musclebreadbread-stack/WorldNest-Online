import type { LocaleMessages } from "../index";

/** Thai (ไทย). */
export const th: LocaleMessages = {
  "common.loading": "กำลังโหลด...",

  "landing.tagline": "เกม MMO จำลองชีวิตแบบ 2D ที่เล่นได้ในเบราว์เซอร์",
  "landing.subtitle": "สำรวจโลกที่สร้างขึ้นใหม่ไม่ซ้ำ สร้างบ้าน และเล่นกับเพื่อน",
  "landing.play": "เล่นเลย",

  "auth.signInSubtitle": "เข้าสู่ระบบบัญชีของคุณ",
  "auth.signUpSubtitle": "สร้างบัญชีใหม่",
  "auth.usernameLabel": "ชื่อผู้ใช้",
  "auth.usernamePlaceholder": "ตั้งชื่อผู้ใช้",
  "auth.emailLabel": "อีเมล",
  "auth.emailPlaceholder": "you@example.com",
  "auth.passwordLabel": "รหัสผ่าน",
  "auth.passwordPlaceholder": "กรอกรหัสผ่านของคุณ",
  "auth.signIn": "เข้าสู่ระบบ",
  "auth.signUp": "สมัครสมาชิก",
  "auth.submitting": "รอสักครู่...",
  "auth.switchToSignUp": "ยังไม่มีบัญชี? สมัครสมาชิก",
  "auth.switchToSignIn": "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ",
  "auth.genericError": "เข้าสู่ระบบไม่สำเร็จ ตรวจสอบการตั้งค่า Supabase",

  "game.loading": "กำลังโหลดเกม...",

  "hud.connected": "เชื่อมต่อแล้ว",
  "hud.connecting": "กำลังเชื่อมต่อ",
  "hud.disconnected": "ไม่ได้เชื่อมต่อ",
  "hud.playersOnline": "ผู้เล่นออนไลน์: {count}",
  "hud.coordinates": "X: {x} Y: {y}",
  "hud.chunk": "โซน: {chunkX}, {chunkY}",
  "hud.controls":
    "WASD / ปุ่มลูกศร · 1-8 ช่องด่วน · I กระเป๋า · E เก็บเกี่ยว / ปลูก · B ก่อสร้าง · M แผนที่ · P ตั้งค่า · Enter แชท",
  "hud.health": "พลังชีวิต",
  "hud.energy": "พลังงาน",
  "hud.signOut": "ออกจากระบบ",
  "hud.signingOut": "กำลังออกจากระบบ...",

  "clock.format": "วันที่ {day} · {time} · {phase}",
  "clock.phase.dawn": "รุ่งอรุณ",
  "clock.phase.day": "กลางวัน",
  "clock.phase.dusk": "พลบค่ำ",
  "clock.phase.night": "กลางคืน",

  "inventory.title": "กระเป๋า",
  "inventory.close": "ปิด (I)",

  "build.title": "โหมดก่อสร้าง",
  "build.empty": "ไม่มีไอเทมที่วางได้ในช่องด่วน",
  "build.hint": "กด Q หรือคลิกเพื่อวางบนช่องด้านหน้า · กด B เพื่อออก",

  "chat.placeholder": "กด Enter เพื่อแชท",
  "chat.unavailable": "ใช้แชทไม่ได้",
  "chat.ariaLabel": "ข้อความแชท",

  "settings.title": "ตั้งค่า",
  "settings.open": "เปิดการตั้งค่า",
  "settings.close": "ปิด (P)",
  "settings.language": "ภาษา",
  "settings.languageHint": "บันทึกไว้ในอุปกรณ์นี้เท่านั้น",
  "settings.sound": "เสียง",
  "settings.masterVolume": "ระดับเสียงรวม",
  "settings.musicVolume": "ระดับเสียงเพลง",
  "settings.mute": "ปิดเสียงทั้งหมด",
  "settings.soundHint": "เสียงจะเริ่มหลังการคลิกครั้งแรก",

  "item.wood": "ไม้",
  "item.stone": "หิน",
  "item.ore": "แร่",
  "item.fiber": "เส้นใย",
  "item.flower": "ดอกไม้",
  "item.wheat_seed": "เมล็ดข้าวสาลี",
  "item.wheat": "ข้าวสาลี",
  "item.fence": "รั้ว",
  "item.chest": "หีบ",
};
