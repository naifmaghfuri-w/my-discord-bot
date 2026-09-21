import { createServer } from "node:http";
import { logger } from "./logger";

/**
 * خادم صغير جداً: Render يتطلب أن تستمع خدمة الويب على المنفذ PORT.
 * كذلك يُستخدم كـ health check.
 */
export function startHealthServer(port: number): void {
  createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot is running");
  }).listen(port, "0.0.0.0", () => logger.info(`Health server يعمل على المنفذ ${port}`));
}
