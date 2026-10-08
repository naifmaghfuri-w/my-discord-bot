import { gunzipSync, gzipSync } from "node:zlib";

/**
 * ترميز النسخة الاحتياطية: JSON عادي، مع حفظ نوع التواريخ والمعرّفات (ObjectId)
 * حتى ترجع كما كانت عند الاستعادة.
 */
export interface BackupFile {
  version: 1;
  createdAt: string;
  collections: Record<string, unknown[]>;
}

export function serializeBackup(collections: Record<string, unknown[]>): string {
  const payload: BackupFile = { version: 1, createdAt: new Date().toISOString(), collections };
  return JSON.stringify(payload, function (this: Record<string, unknown>, key: string, value: unknown) {
    const raw = this[key] as { _bsontype?: string; toString(): string } | Date | undefined;
    if (raw instanceof Date) return { $date: raw.toISOString() };
    if (raw && typeof raw === "object" && "_bsontype" in raw && raw._bsontype === "ObjectId") return { $oid: raw.toString() };
    return value;
  });
}

export const gzip = (text: string): Buffer => gzipSync(Buffer.from(text, "utf8"), { level: 9 });

/** يقرأ ملف .json أو .json.gz ويرجّع الأنواع الأصلية */
export function parseBackup(data: Buffer, ObjectIdCtor: new (hex: string) => unknown): BackupFile {
  const isGzip = data.length > 2 && data[0] === 0x1f && data[1] === 0x8b;
  const text = (isGzip ? gunzipSync(data) : data).toString("utf8");
  const parsed = JSON.parse(text, (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (typeof v.$date === "string" && Object.keys(v).length === 1) return new Date(v.$date);
      if (typeof v.$oid === "string" && Object.keys(v).length === 1) return new ObjectIdCtor(v.$oid);
    }
    return v;
  }) as BackupFile;
  if (parsed.version !== 1 || typeof parsed.collections !== "object") throw new Error("ملف نسخة احتياطية غير صالح");
  return parsed;
}
