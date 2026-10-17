import { FraudRule, Transaction, Alert, Investigation } from "../models.js";
import mongoose from "mongoose";

type TxInput = {
  amount: number; accountId: string; timestamp: Date; isNewRecipient?: boolean;
  customerId?: string; recipientId?: string;
};

function riskLevel(score: number): "Low" | "Medium" | "High" | "Critical" {
  if (score >= 75) return "Critical";
  if (score >= 50) return "High";
  if (score >= 25) return "Medium";
  return "Low";
}

export async function scoreTransaction(input: TxInput, excludeId?: string) {
  const rules = await FraudRule.find({ enabled: true }).lean();
  let score = 0;
  const reasons: string[] = [];
  const matchedRuleIds: mongoose.Types.ObjectId[] = [];
  const add = (type: string, condition: boolean, reason: string) => {
    const rule = rules.find(r => r.ruleType === type);
    if (rule && condition) {
      score += rule.weight;
      reasons.push(reason);
      matchedRuleIds.push(new mongoose.Types.ObjectId(String(rule._id)));
    }
  };
  add("high_amount", input.amount >= 5000, `High transaction amount (${input.amount})`);
  add("new_recipient", input.isNewRecipient === true, "Recipient has not been used before");
  const hour = new Date(input.timestamp).getUTCHours();
  add("unusual_hour", hour < 5 || hour >= 23, "Transaction occurred during unusual UTC hours");
  const since = new Date(new Date(input.timestamp).getTime() - 10 * 60 * 1000);
  const filter: Record<string, unknown> = { accountId: input.accountId, timestamp: { $gte: since, $lte: input.timestamp } };
  if (excludeId) filter._id = { $ne: excludeId };
  const recentCount = await Transaction.countDocuments(filter);
  add("rapid_activity", recentCount >= 3, `Rapid activity: ${recentCount + 1} transactions within 10 minutes`);
  // Transparent demo heuristic; this is not a trained ML model.
  add("account_behavior", input.amount >= 2500 && input.amount < 5000 && hour >= 0 && hour < 5, "Unusual combination of amount and UTC transaction hour");
  score = Math.min(100, score);
  return { riskScore: score, riskLevel: riskLevel(score), riskReasons: reasons, matchedRuleIds };
}

export async function evaluateAndAlert(transactionId: string) {
  const tx = await Transaction.findOne({
    $or: [
      ...(mongoose.isValidObjectId(transactionId) ? [{ _id: transactionId }] : []),
      { transactionId }
    ]
  });
  if (!tx) return null;
  const result = await scoreTransaction({
    amount: tx.amount, accountId: tx.accountId, timestamp: tx.timestamp,
    isNewRecipient: tx.isNewRecipient, customerId: tx.customerId, recipientId: tx.recipientId
  }, String(tx._id));
  tx.riskScore = result.riskScore;
  tx.riskLevel = result.riskLevel;
  tx.riskReasons = result.riskReasons;
  tx.matchedRuleIds = result.matchedRuleIds;
  await tx.save();

  if (result.riskScore >= 50) {
    const severity = result.riskScore >= 75 ? "Critical" : "High";
    const detectionKey = `score-${result.riskScore}-rules-${[...result.matchedRuleIds].map(String).sort().join("-")}`;
    await Alert.updateMany(
      { transaction: tx._id, status: "Open", detectionKey: { $ne: detectionKey } },
      { status: "Resolved", resolvedAt: new Date() }
    );
    const alert = await Alert.findOneAndUpdate(
      { transaction: tx._id, detectionKey },
      { $setOnInsert: { transaction: tx._id, detectionKey, severity, title: `${severity} risk transaction`, description: result.riskReasons.join("; ") || "Risk threshold exceeded", status: "Open" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await Investigation.updateOne(
      { transaction: tx._id },
      { $setOnInsert: { transaction: tx._id, alert: alert._id, status: "New" } },
      { upsert: true }
    );
  } else {
    await Alert.updateMany(
      { transaction: tx._id, status: "Open" },
      { status: "Resolved", resolvedAt: new Date() }
    );
  }
  return tx;
}
