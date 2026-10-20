/** أصوات Microsoft Edge TTS المجانية (عربية) */
export interface TalkVoice {
  id: string;
  label: string;
  /** اسم الصوت في Edge TTS */
  edge: string;
}

export const VOICES: TalkVoice[] = [
  { id: "narin", label: "نارين بيوتي — سورية", edge: "ar-SY-AmanyNeural" },
  { id: "zariyah", label: "زارية — سعودية", edge: "ar-SA-ZariyahNeural" },
  { id: "hamed", label: "حامد — سعودي", edge: "ar-SA-HamedNeural" },
  { id: "abdullah", label: "عبدالله — عماني", edge: "ar-OM-AbdullahNeural" },
  { id: "fahad", label: "فهد — كويتي", edge: "ar-KW-FahedNeural" },
  { id: "hamdan", label: "حمدان — إماراتي", edge: "ar-AE-HamdanNeural" },
  { id: "laith", label: "ليث — سوري", edge: "ar-SY-LaithNeural" },
];

export const VOICE_MAP: Record<string, TalkVoice> = Object.fromEntries(VOICES.map((v) => [v.id, v]));
export const getVoice = (id: string): TalkVoice => VOICE_MAP[id] ?? VOICES[0];
