import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** يرجع كل ملفات .ts/.js داخل مجلد (وما تحته) */
export function walk(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    })
    .filter((f) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.endsWith(".d.ts"));
}
