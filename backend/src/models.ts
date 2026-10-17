import mongoose, { Schema, model, InferSchemaType } from "mongoose";

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["admin", "analyst", "viewer"], default: "analyst" },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const transactionSchema = new Schema({
  transactionId: { type: String, required: true, unique: true, index: true },
  customerId: { type: String, required: true },
  customerName: { type: String, required: true, trim: true },
  accountId: { type: String, required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "USD", uppercase: true },
  merchantName: { type: String, required: true },
  recipientId: { type: String, default: "" },
  channel: { type: String, enum: ["Card", "Bank Transfer", "Online", "Mobile", "ATM"], default: "Online" },
  transactionType: { type: String, default: "Payment" },
  timestamp: { type: Date, required: true, index: true },
  isNewRecipient: { type: Boolean, default: false },
  riskScore: { type: Number, min: 0, max: 100, default: 0 },
  riskLevel: { type: String, enum: ["Low", "Medium", "High", "Critical"], default: "Low" },
  riskReasons: { type: [String], default: [] },
  matchedRuleIds: [{ type: Schema.Types.ObjectId, ref: "FraudRule" }],
  status: { type: String, enum: ["New", "Reviewing", "Resolved", "False Positive"], default: "New" }
}, { timestamps: true });

const alertSchema = new Schema({
  transaction: { type: Schema.Types.ObjectId, ref: "Transaction", required: true, index: true },
  detectionKey: { type: String, required: true },
  severity: { type: String, enum: ["Medium", "High", "Critical"], required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ["Open", "Reviewing", "Resolved", "False Positive"], default: "Open" },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
  resolvedAt: { type: Date, default: null }
}, { timestamps: true });
alertSchema.index({ transaction: 1, detectionKey: 1 }, { unique: true });

const investigationSchema = new Schema({
  transaction: { type: Schema.Types.ObjectId, ref: "Transaction", required: true, index: true },
  alert: { type: Schema.Types.ObjectId, ref: "Alert", default: null },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
  status: { type: String, enum: ["New", "Reviewing", "Resolved", "False Positive"], default: "New" },
  notes: [{ author: { type: Schema.Types.ObjectId, ref: "User" }, body: { type: String, required: true }, createdAt: { type: Date, default: Date.now } }],
  decision: { type: String, enum: ["Confirmed Fraud", "Legitimate Activity", "Inconclusive"], default: "Inconclusive" },
  resolvedAt: { type: Date, default: null }
}, { timestamps: true });

const ruleSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, required: true },
  ruleType: { type: String, enum: ["high_amount", "rapid_activity", "unusual_hour", "new_recipient", "account_behavior"], required: true },
  weight: { type: Number, min: 0, max: 100, required: true },
  enabled: { type: Boolean, default: true },
  configuration: { type: Schema.Types.Mixed, default: {} },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

const auditLogSchema = new Schema({
  actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export const User = mongoose.models.User || model("User", userSchema);
export const Transaction = mongoose.models.Transaction || model("Transaction", transactionSchema);
export const Alert = mongoose.models.Alert || model("Alert", alertSchema);
export const Investigation = mongoose.models.Investigation || model("Investigation", investigationSchema);
export const FraudRule = mongoose.models.FraudRule || model("FraudRule", ruleSchema);
export const AuditLog = mongoose.models.AuditLog || model("AuditLog", auditLogSchema);

export type TransactionDoc = InferSchemaType<typeof transactionSchema>;
