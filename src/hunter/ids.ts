/** customId بالشكل: base|ownerId|extra? (ownerId يمنع التلاعب بقائمة غيرك) */
export const HX_HUB = "hx_hub";
export const HX_STORY = "hx_story";
export const HX_STORY_GO = "hx_storygo";
export const HX_GREED = "hx_greed";
export const HX_FIGHT_MENU = "hx_fightmenu";
export const HX_BOT_MENU = "hx_botmenu";
export const HX_PVP_MENU = "hx_pvpmenu";
export const HX_PICK_ENEMY = "hx_pick";
export const HX_PVP_PICK = "hx_pvppick";
export const HX_CHARS = "hx_chars";
export const HX_SHOP = "hx_shop";
export const HX_SELECT_CHAR = "hx_selchar";
export const HX_UPG = "hx_upg";
export const HX_BUY = "hx_buy";
export const HX_OPTIONS = "hx_options";
export const HX_LANG = "hx_lang";
export const HX_FISH = "hx_fish";
export const HX_ACT = "hx_act";
export const HX_RETREAT = "hx_retreat";

export const HX_DUEL_ACCEPT = "hx_duelacc";
export const HX_DUEL_DECLINE = "hx_dueldec";
export const HX_DUEL_ACT = "hx_duelact";
export const HX_DUEL_FORFEIT = "hx_duelff";

export const cid = (base: string, owner: string, extra?: string | number): string =>
  extra === undefined ? `${base}|${owner}` : `${base}|${owner}|${extra}`;

export function parseCid(customId: string): { base: string; ownerId: string; extra?: string } {
  const [base, ownerId = "", extra] = customId.split("|");
  return { base, ownerId, extra };
}
