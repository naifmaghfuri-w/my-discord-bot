import { existsSync } from "node:fs";
import { join } from "node:path";
import { GlobalFonts } from "@napi-rs/canvas";
import { logger } from "../../utils/logger";

const FONTS_DIR = join(__dirname, "..", "..", "assets", "fonts");

export const FONT_BOLD = "QuestFont-Bold";
export const FONT_REGULAR = "QuestFont-Regular";

let registered = false;

/**
 * يسجّل الخط العربي من src/assets/fonts.
 * لازم تحط هنا ملفين: Bold.ttf و Regular.ttf (ننصح بخط Cairo من Google Fonts، مجاني).
 * بدون هذا الخط، الحروف العربية ما راح تظهر صح بالصور (مربعات فارغة).
 */
export function ensureFontsRegistered(): boolean {
  if (registered) return true;

  const bold = join(FONTS_DIR, "Bold.ttf");
  const regular = join(FONTS_DIR, "Regular.ttf");

  if (!existsSync(bold) || !existsSync(regular)) {
    logger.warn(
      `⚠️ ملفات الخط العربي غير موجودة (${FONTS_DIR}). حمّل خط Cairo من Google Fonts وضع ` +
        `Cairo-Bold.ttf باسم Bold.ttf و Cairo-Regular.ttf باسم Regular.ttf في هذا المجلد.`,
    );
    return false;
  }

  GlobalFonts.registerFromPath(bold, FONT_BOLD);
  GlobalFonts.registerFromPath(regular, FONT_REGULAR);
  registered = true;
  logger.info("✅ تم تحميل الخط العربي لبطاقات المهام");
  return true;
}
