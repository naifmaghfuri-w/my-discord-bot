/** customId بالشكل: base|ownerId|extra? (ownerId يمنع التلاعب بلعبة غيرك) */
export const HX_APPLY = "hx_apply";
export const HX_CARD = "hx_card";
export const HX_FIGHT_MENU = "hx_fightmenu";
export const HX_PICK_ENEMY = "hx_pick";
export const HX_ACT = "hx_act";
export const HX_RETREAT = "hx_retreat";
export const HX_TRAIN_MENU = "hx_trainmenu";
export const HX_TRAIN_PICK = "hx_trainpick";

export const HX_EXAM = "hx_exam";
export const HX_EXAM_GO = "hx_examgo";
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
