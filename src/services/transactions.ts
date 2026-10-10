import { Transaction, type TransactionType } from "../database/models/Transaction";
import { logger } from "../utils/logger";

/** يسجّل عملية مالية (لا يرمي خطأ إذا فشل، مجرد سجل وليس جزءاً من العملية نفسها) */
export async function logTransaction(
  guildId: string,
  userId: string,
  type: TransactionType,
  amount: number,
  counterpartyId?: string,
): Promise<void> {
  await Transaction.create({ guildId, userId, type, amount, counterpartyId }).catch((err) => {
    logger.error("فشل تسجيل عملية مالية", err);
  });
}

const TYPE_LABELS: Record<TransactionType, string> = {
  deposit: "🏦 إيداع",
  withdraw: "💸 سحب",
  interest: "📈 فائدة بنكية",
  rob_gain: "🦹 سرقة (كسب)",
  rob_loss: "🚨 تعرّضت للسرقة",
  rob_fine: "🚔 غرامة سرقة فاشلة",
  pay_sent: "📤 تحويل مُرسَل",
  pay_received: "📥 تحويل مُستلَم",
  shop_purchase: "🛒 شراء من المتجر",
  lab_sale: "🧪 بيع مركب بالمختبر",
  lab_purchase: "⚗️ شراء عنصر من المختبر",
  salary: "💼 راتب وظيفة",
  job_fee: "📝 رسوم تقديم وظيفة",
};

export function transactionLabel(type: TransactionType): string {
  return TYPE_LABELS[type] ?? type;
}

export async function getRecentTransactions(guildId: string, userId: string, limit = 10) {
  return Transaction.find({ guildId, userId }).sort({ createdAt: -1 }).limit(limit);
}
