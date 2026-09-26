const time = () => new Date().toISOString();

export const logger = {
  info: (msg: string) => console.log(`[${time()}] [INFO] ${msg}`),
  warn: (msg: string) => console.warn(`[${time()}] [WARN] ${msg}`),
  error: (msg: string, err?: unknown) => console.error(`[${time()}] [ERROR] ${msg}`, err ?? ""),
};
