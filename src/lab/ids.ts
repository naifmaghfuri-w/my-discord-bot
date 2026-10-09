/**
 * كل customId بالمختبر بالشكل: base|ownerId|extra?
 * ownerId يمنع أي شخص من التلاعب بمختبر غيره.
 */
export const SELECT_ELEMENT = "lab_select_element";
export const SELECT_COMPOUND = "lab_select_compound";

export const TEMP_UP = "lab_temp_up";
export const TEMP_DOWN = "lab_temp_down";
export const PRESSURE_UP = "lab_pressure_up";
export const PRESSURE_DOWN = "lab_pressure_down";
export const STEP_TOGGLE = "lab_step_toggle";
export const REACT = "lab_react";
export const RESET = "lab_reset";

export const OPEN_WAREHOUSE = "lab_open_warehouse";
export const OPEN_CODEX = "lab_open_codex";
export const OPEN_MARKET = "lab_open_market";
export const OPEN_SHOP = "lab_open_shop";
export const OPEN_LEVELS = "lab_open_levels";
export const BACK = "lab_back"; // رجوع للقائمة الرئيسية
export const OPEN_LAB = "lab_open_lab"; // المعمل (القارورة)
export const OPEN_EXTRA = "lab_open_extra"; // القائمة الإضافية
export const CODEX_PAGE = "lab_codex_page";
export const NOOP = "lab_noop";

export const SHOP_BUY_SELECT = "lab_shop_buy_select";
export const SHOP_QTY = "lab_shop_qty";
export const MARKET_SELL_SELECT = "lab_market_sell_select";
export const MARKET_SELLALL_SELECT = "lab_market_sellall_select";
export const LEVELS_UNLOCK_SELECT = "lab_levels_unlock_select";

export const PUBLISH = "lab_publish";

export const OPEN_QUESTS = "lab_open_quests";
export const OPEN_ACH = "lab_open_ach";
export const OPEN_HINTS = "lab_open_hints";
export const HINT_PAGE = "lab_hint_page";
export const HINT_BUY_SELECT = "lab_hint_buy_select";
export const OPEN_EQUIP = "lab_open_equip";
export const EQUIP_BUY_SELECT = "lab_equip_buy_select";
export const OPEN_ORDERS = "lab_open_orders";
export const ORDER_DELIVER_SELECT = "lab_order_deliver_select";
export const OPEN_EXPED = "lab_open_exped";
export const EXPED_START = "lab_exped_start";
export const EXPED_COLLECT = "lab_exped_collect";
export const OPEN_TRADE_HELP = "lab_open_trade_help";

export const TRADE_PICK = "lab_trade_pick";
export const TRADE_OK = "lab_trade_ok";
export const TRADE_NO = "lab_trade_no";
export const TRADE_CANCEL = "lab_trade_cancel";

export function cid(base: string, ownerId: string, extra?: string | number): string {
  return extra === undefined ? `${base}|${ownerId}` : `${base}|${ownerId}|${extra}`;
}

export function parseCid(customId: string): { base: string; ownerId: string; extra?: string } {
  const [base, ownerId = "", extra] = customId.split("|");
  return { base, ownerId, extra };
}
