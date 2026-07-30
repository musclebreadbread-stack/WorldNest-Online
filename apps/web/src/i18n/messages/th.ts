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
  "hud.coins": "{count} เหรียญ",

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

  "npc.pip.name": "พิพ คนสวน",
  "npc.juno.name": "จูโน เจ้าของร้าน",
  "npc.ada.name": "เอดา นักสำรวจ",

  "dialogue.close": "จบการสนทนา",
  "dialogue.hint": "กด 1-4 หรือแตะคำตอบ",
  "dialogue.option.bye": "ไว้เจอกันนะ!",
  "dialogue.option.back": "อยากถามเรื่องอื่น",
  "dialogue.pip.greeting":
    "ยินดีต้อนรับสู่ WorldNest! ฉันดูแลแปลงดอกไม้แถวนี้อยู่ มีอะไรให้ช่วยไหม",
  "dialogue.pip.tips":
    "ยืนหน้าผืนหญ้าแล้วกด E จะกลายเป็นแปลงเพาะปลูก กด E อีกครั้งเพื่อหยอดเมล็ด กลับมาอีกไม่กี่ชั่วโมงข้าวสาลีก็พร้อมเก็บแล้ว",
  "dialogue.pip.option.tips": "เริ่มทำไร่อย่างไรดี",
  "dialogue.juno.greeting":
    "ยินดีต้อนรับสู่ร้านเล็ก ๆ ของฉัน! ของที่เก็บมาฉันรับซื้อ ของที่ยังขาดฉันก็มีขาย",
  "dialogue.juno.prices":
    "ฉันรับซื้อถูกกว่าราคาขายอยู่หน่อย ร้านจึงอยู่ได้ แต่ถ้าเก็บมามาก ๆ ก็ยังคุ้มสำหรับเธออยู่ดี",
  "dialogue.juno.option.shop": "ขอดูของหน่อย",
  "dialogue.juno.option.prices": "ราคาคิดกันอย่างไร",
  "dialogue.ada.greeting":
    "สวัสดีนักสำรวจ! ฉันจดงานที่หมู่บ้านต้องทำไว้เป็นรายการ",
  "dialogue.ada.quests": "เลือกงานมาหนึ่งอย่าง แล้วฉันจะจดชื่อเธอไว้ข้าง ๆ",
  "dialogue.ada.report": "เสร็จแล้วหรือ บอกหน่อยว่าทำงานไหนสำเร็จ",
  "dialogue.ada.option.quests": "มีงานอะไรบ้าง",
  "dialogue.ada.option.report": "ฉันทำงานเสร็จแล้ว",
  "dialogue.ada.option.wood": "เก็บฟืน",
  "dialogue.ada.option.fence": "ล้อมรั้วให้สวน",
  "dialogue.ada.option.greet": "ไปทักทายพิพ",

  "touch.stick": "จอยควบคุมการเดิน",
  "touch.interact": "ใช้",
  "touch.place": "วาง",
  "touch.map": "แผนที่",

  "shop.title": "ร้านค้า",
  "shop.close": "ปิด (Esc)",
  "shop.hint": "ราคาคงที่เสมอ ร้านรับซื้อถูกกว่าราคาขายเล็กน้อย",
  "shop.item": "ของ",
  "shop.held": "มี {count}",
  "shop.buy": "ซื้อ",
  "shop.sell": "ขาย",
  "shop.buyQuantity": "ซื้อ {quantity}",
  "shop.sellQuantity": "ขาย {quantity}",
  "shop.buyPrice": "ใช้ {coins} เหรียญ",
  "shop.sellPrice": "ได้ {coins} เหรียญ",

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
