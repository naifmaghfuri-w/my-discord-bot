/** customId بالشكل: base|a|b  (البادئة chat_) */
export const CHAT_CREATE = "chat_create";
export const CHAT_INVITE = "chat_invite";
export const CHAT_RADAR = "chat_radar";
export const CHAT_KNOCK = "chat_knock";
export const CHAT_ZAJIL = "chat_zajil";
export const CHAT_SETTINGS = "chat_settings";

export const CHAT_INVITE_PICK = "chat_invite_pick";
export const CHAT_KNOCK_PICK = "chat_knock_pick";
export const CHAT_RADAR_PICK = "chat_radar_pick";
export const CHAT_RADAR_JOIN = "chat_radar_join";
export const CHAT_ZAJIL_PICK = "chat_zajil_pick";
export const CHAT_ZAJIL_MODAL = "chat_zajil_modal";
export const CHAT_ZAJIL_REPLY = "chat_zajil_reply";
export const CHAT_SET_ZAJIL = "chat_set_zajil";
export const CHAT_SET_INV = "chat_set_inv";

// أزرار لوحة الغرفة
export const CHAT_ADD = "chat_add";
export const CHAT_REMOVE = "chat_remove";
export const CHAT_REMOVE_PICK = "chat_remove_pick";
export const CHAT_TRANSFER = "chat_transfer";
export const CHAT_TRANSFER_PICK = "chat_transfer_pick";
export const CHAT_VOICE = "chat_voice";
export const CHAT_RENAME = "chat_rename";
export const CHAT_RENAME_MODAL = "chat_rename_modal";
export const CHAT_CLEAR = "chat_clear";
export const CHAT_CLEAR_YES = "chat_clear_yes";
export const CHAT_DELETE = "chat_delete";
export const CHAT_DELETE_YES = "chat_delete_yes";
export const CHAT_LEAVE = "chat_leave";
export const CHAT_DOOR = "chat_door";
export const CHAT_CANCEL = "chat_cancel";

// دعوات (تصل بالخاص) وطلبات الطرق
export const CHAT_INV_OK = "chat_inv_ok";
export const CHAT_INV_NO = "chat_inv_no";
export const CHAT_INV_STOP = "chat_inv_stop";
export const CHAT_KNOCK_OK = "chat_knock_ok";
export const CHAT_KNOCK_NO = "chat_knock_no";

export function cid(base: string, ...parts: (string | number)[]): string {
  return [base, ...parts].join("|");
}

export function parseCid(customId: string): { base: string; args: string[] } {
  const [base, ...args] = customId.split("|");
  return { base, args };
}
