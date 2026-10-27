/** ألوان الخطوط والمستوى */
export const COLORS = [
  { id: "sky", name: "سماوي", hex: "#38bdf8" },
  { id: "red", name: "أحمر", hex: "#ef4444" },
  { id: "orange", name: "برتقالي", hex: "#fb923c" },
  { id: "gold", name: "ذهبي", hex: "#facc15" },
  { id: "green", name: "أخضر", hex: "#4ade80" },
  { id: "teal", name: "تركوازي", hex: "#2dd4bf" },
  { id: "violet", name: "بنفسجي", hex: "#a78bfa" },
  { id: "pink", name: "وردي", hex: "#f472b6" },
] as const;

export const colorById = (id: string) => COLORS.find((c) => c.id === id) ?? COLORS[0];
