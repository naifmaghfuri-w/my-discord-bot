/** استوديو الخلفيات (تُرسم بالكود) وألوان الخطوط والمستوى */
export const BACKGROUNDS = [
  { id: "midnight", name: "منتصف الليل", desc: "سماء داكنة بنجوم" },
  { id: "sunset", name: "غروب", desc: "شمس بين البنفسجي والبرتقالي" },
  { id: "forest", name: "غابة", desc: "تلال خضراء هادئة" },
  { id: "ocean", name: "محيط", desc: "أمواج بحرية" },
  { id: "rose", name: "وردي", desc: "فقاعات ضوء وردية" },
  { id: "gold", name: "ذهبي", desc: "خطوط ذهبية على الأسود" },
  { id: "carbon", name: "كربون", desc: "أسود عصري منقّط" },
  { id: "aurora", name: "شفق", desc: "أضواء قطبية ملوّنة" },
] as const;

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

export const bgById = (id: string) => BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
export const colorById = (id: string) => COLORS.find((c) => c.id === id) ?? COLORS[0];
