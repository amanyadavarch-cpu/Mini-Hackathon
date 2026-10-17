import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDatabase } from "../config/db.js";
import { User, FraudRule, Transaction, Alert } from "../models.js";
import { evaluateAndAlert } from "../services/fraud.js";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI must be set");
await connectDatabase(uri);

const email = (process.env.DEMO_ADMIN_EMAIL || "admin@fraudradar.local").toLowerCase();
const password = process.env.DEMO_ADMIN_PASSWORD || "ChangeMe123!";
const admin = await User.findOneAndUpdate(
  { email },
  { $set: { name: "Fraud Radar Admin", email, passwordHash: await bcrypt.hash(password, 12), role: "admin", isActive: true } },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

const defaults = [
  { name: "High transaction amount", description: "Flags transactions at or above $5,000.", ruleType: "high_amount", weight: 25, enabled: true, configuration: { threshold: 5000 } },
  { name: "Rapid transaction activity", description: "Flags 4 or more transactions in a rolling 10-minute window.", ruleType: "rapid_activity", weight: 25, enabled: true, configuration: { count: 4, windowMinutes: 10 } },
  { name: "Unusual transaction hour", description: "Flags transactions before 05:00 or from 23:00 UTC.", ruleType: "unusual_hour", weight: 10, enabled: true, configuration: { timezone: "UTC", startHour: 5, endHour: 23 } },
  { name: "New recipient", description: "Flags transactions to a new recipient.", ruleType: "new_recipient", weight: 15, enabled: true, configuration: {} },
  { name: "Unusual account behavior", description: "Demo heuristic: moderate-high amount during early UTC hours.", ruleType: "account_behavior", weight: 25, enabled: true, configuration: { minAmount: 2500, maxAmount: 5000 } }
];
for (const rule of defaults) await FraudRule.findOneAndUpdate({ ruleType: rule.ruleType }, { $set: rule }, { upsert: true, new: true });

const now = Date.now();
const unusualTimestamp = new Date();
unusualTimestamp.setUTCHours(2, 0, 0, 0);
if (unusualTimestamp.getTime() > now) unusualTimestamp.setUTCDate(unusualTimestamp.getUTCDate() - 1);
const sample = [
  ["TX-1001", "C-001", "Alex Morgan", "ACC-001", 125.5, "Northstar Coffee", "Card", 2, false],
  ["TX-1002", "C-002", "Jamie Chen", "ACC-002", 840, "Metro Electronics", "Online", 5, true],
  ["TX-1003", "C-003", "Taylor Brooks", "ACC-003", 6800, "Global Transfers", "Bank Transfer", 1, true],
  ["TX-1004", "C-004", "Jordan Patel", "ACC-004", 3200, "QuickPay Recipient", "Mobile", 3, true],
  ["TX-1005", "C-001", "Alex Morgan", "ACC-001", 75, "City Market", "Card", 0, false],
  ["TX-1006", "C-005", "Sam Rivera", "ACC-005", 9900, "International Remit", "Bank Transfer", 4, true]
] as const;

for (let i = 0; i < sample.length; i++) {
  const [transactionId, customerId, customerName, accountId, amount, merchantName, channel, hoursAgo, isNewRecipient] = sample[i];
  const tx = await Transaction.findOneAndUpdate(
    { transactionId },
    { $setOnInsert: { transactionId, customerId, customerName, accountId, amount, currency: "USD", merchantName, recipientId: `REC-${i + 1}`, channel, transactionType: "Payment", timestamp: i === 2 ? unusualTimestamp : new Date(now - hoursAgo * 60 * 60 * 1000), isNewRecipient, status: "New" } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await evaluateAndAlert(String(tx._id));
}
console.log(`Seed complete. Admin: ${admin.email}. Use the password configured in DEMO_ADMIN_PASSWORD.`);
const mongoose = await import("mongoose");
await mongoose.default.disconnect();
