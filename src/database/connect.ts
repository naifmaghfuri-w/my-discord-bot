import mongoose from "mongoose";
import { logger } from "../utils/logger";

export async function connectDatabase(uri: string): Promise<void> {
  mongoose.connection.on("disconnected", () => logger.warn("انقطع الاتصال بقاعدة البيانات"));
  mongoose.connection.on("reconnected", () => logger.info("عاد الاتصال بقاعدة البيانات"));

  await mongoose.connect(uri);
  logger.info("✅ متصل بقاعدة البيانات");
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
