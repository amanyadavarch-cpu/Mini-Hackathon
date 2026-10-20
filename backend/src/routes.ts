import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { User, Transaction, Alert, FraudRule, Investigation, AuditLog } from "./models.js";
import { allowRoles, asyncHandler, authenticate, audit, validate } from "./lib/http.js";
import { evaluateAndAlert } from "./services/fraud.js";

const router = Router();
const loginSchema = z.object({ email: z.string().trim().email().transform(v => v.toLowerCase()), password: z.string().min(8) });
const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  password: z.string().min(8).max(72)
});
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false
});
const transactionSchema = z.object({
  transactionId: z.string().min(3).max(80).optional(),
  customerId: z.string().min(1), customerName: z.string().min(1),
  accountId: z.string().min(1), amount: z.number().positive().max(100000000),
  currency: z.string().length(3).default("USD"), merchantName: z.string().min(1),
  recipientId: z.string().optional().default(""),
  channel: z.enum(["Card", "Bank Transfer", "Online", "Mobile", "ATM"]).default("Online"),
  transactionType: z.string().default("Payment"), timestamp: z.coerce.date(),
  isNewRecipient: z.boolean().default(false)
});

router.post("/auth/login", validate(loginSchema), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email, isActive: true }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) return res.status(401).json({ success: false, error: "Invalid credentials" });
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
  const token = jwt.sign({ id: String(user._id), email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "8h" });
  res.json({ success: true, data: { token, user: { id: user._id, name: user.name, email: user.email, role: user.role } } });
}));
router.post("/auth/register", registrationLimiter, validate(registerSchema), asyncHandler(async (req, res) => {
  const { name, email, password } = req.body as z.infer<typeof registerSchema>;
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
  const existingUser = await User.exists({ email });
  if (existingUser) return res.status(409).json({ success: false, error: "An account with this email already exists" });

  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 12),
    role: "analyst"
  });
  const token = jwt.sign({ id: String(user._id), email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "8h" });
  res.status(201).json({ success: true, data: { token, user: { id: user._id, name: user.name, email: user.email, role: user.role } } });
}));
router.get("/auth/me", authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.id).select("name email role isActive");
  if (!user || !user.isActive) return res.status(401).json({ success: false, error: "User is inactive" });
  res.json({ success: true, data: user });
}));

router.get("/transactions", authenticate, asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const filter: Record<string, any> = {};
  if (req.query.riskLevel) filter.riskLevel = req.query.riskLevel;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from || req.query.to) filter.timestamp = { ...(req.query.from ? { $gte: new Date(String(req.query.from)) } : {}), ...(req.query.to ? { $lte: new Date(String(req.query.to)) } : {}) };
  if (req.query.minAmount || req.query.maxAmount) filter.amount = { ...(req.query.minAmount ? { $gte: Number(req.query.minAmount) } : {}), ...(req.query.maxAmount ? { $lte: Number(req.query.maxAmount) } : {}) };
  if (req.query.search) {
    const escaped = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = ["transactionId", "customerName", "accountId", "merchantName", "recipientId"].map(k => ({ [k]: { $regex: escaped, $options: "i" } }));
  }
  const sortAllow = ["timestamp", "amount", "riskScore", "customerName", "transactionId"];
  const sortField = sortAllow.includes(String(req.query.sort)) ? String(req.query.sort) : "timestamp";
  const sortDir = req.query.order === "asc" ? 1 : -1;
  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ [sortField]: sortDir }).skip((page - 1) * limit).limit(limit).lean(),
    Transaction.countDocuments(filter)
  ]);
  res.json({ success: true, data: { items, page, limit, total, totalPages: Math.ceil(total / limit) } });
}));
router.get("/transactions/:id", authenticate, asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const tx = await Transaction.findOne({ $or: [...(mongoose.isValidObjectId(id) ? [{ _id: id }] : []), { transactionId: id }] });
  if (!tx) return res.status(404).json({ success: false, error: "Transaction not found" });
  res.json({ success: true, data: tx });
}));
router.post("/transactions", authenticate, allowRoles("admin", "analyst"), validate(transactionSchema), asyncHandler(async (req, res) => {
  const tx = await Transaction.create({ ...req.body, transactionId: req.body.transactionId || `TX-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}` });
  const evaluated = await evaluateAndAlert(String(tx._id));
  await audit(req.user?.id, "transaction.created", "Transaction", String(tx._id), { transactionId: tx.transactionId });
  res.status(201).json({ success: true, data: evaluated });
}));
router.post("/transactions/:id/evaluate", authenticate, allowRoles("admin", "analyst"), asyncHandler(async (req, res) => {
  const tx = await evaluateAndAlert(String(req.params.id));
  if (!tx) return res.status(404).json({ success: false, error: "Transaction not found" });
  await audit(req.user?.id, "transaction.evaluated", "Transaction", String(tx._id), { riskScore: tx.riskScore });
  res.json({ success: true, data: tx });
}));
router.get("/transactions/:id/history", authenticate, asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const tx = await Transaction.findOne({ $or: [...(mongoose.isValidObjectId(id) ? [{ _id: id }] : []), { transactionId: id }] }).select("_id");
  if (!tx) return res.status(404).json({ success: false, error: "Transaction not found" });
  const [alerts, investigations] = await Promise.all([Alert.find({ transaction: tx._id }).sort({ createdAt: -1 }), Investigation.find({ transaction: tx._id }).sort({ createdAt: -1 })]);
  res.json({ success: true, data: { alerts, investigations } });
}));
router.patch("/transactions/:id/status", authenticate, allowRoles("admin", "analyst"), asyncHandler(async (req, res) => {
  const parsed = z.object({ status: z.enum(["New", "Reviewing", "Resolved", "False Positive"]) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: "Invalid status" });
  const id = String(req.params.id);
  const transaction = await Transaction.findOne({ $or: [...(mongoose.isValidObjectId(id) ? [{ _id: id }] : []), { transactionId: id }] });
  if (!transaction) return res.status(404).json({ success: false, error: "Transaction not found" });
  const status = parsed.data.status;
  transaction.status = status;
  await transaction.save();

  const resolved = status === "Resolved" || status === "False Positive";
  const investigation = await Investigation.findOne({ transaction: transaction._id });
  if (investigation) {
    investigation.status = status;
    investigation.resolvedAt = resolved ? new Date() : null;
    if (status === "False Positive") investigation.decision = "Legitimate Activity";
    else if (status === "Resolved") investigation.decision = "Inconclusive";
    await investigation.save();
  }
  await Alert.updateMany(
    { transaction: transaction._id },
    { status: status === "New" ? "Open" : status, resolvedAt: resolved ? new Date() : null }
  );
  await audit(req.user?.id, "transaction.status_changed", "Transaction", String(transaction._id), { status });
  res.json({ success: true, data: transaction });
}));

router.get("/alerts", authenticate, asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.severity) filter.severity = req.query.severity;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const [items, total] = await Promise.all([
    Alert.find(filter).populate("transaction").populate("assignedTo", "name email").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Alert.countDocuments(filter)
  ]);
  res.json({ success: true, data: { items, page, limit, total, totalPages: Math.ceil(total / limit) } });
}));
router.patch("/alerts/:id/status", authenticate, allowRoles("admin", "analyst"), asyncHandler(async (req, res) => {
  const parsed = z.object({ status: z.enum(["Open", "Reviewing", "Resolved", "False Positive"]) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: "Invalid status" });
  const alert = await Alert.findByIdAndUpdate(String(req.params.id), { status: parsed.data.status, resolvedAt: ["Resolved", "False Positive"].includes(parsed.data.status) ? new Date() : null }, { new: true });
  if (!alert) return res.status(404).json({ success: false, error: "Alert not found" });
  await audit(req.user?.id, "alert.status_changed", "Alert", String(alert._id), { status: alert.status });
  res.json({ success: true, data: alert });
}));

router.get("/rules", authenticate, asyncHandler(async (_req, res) => res.json({ success: true, data: await FraudRule.find().sort({ createdAt: 1 }) })));
router.patch("/rules/:id", authenticate, allowRoles("admin"), asyncHandler(async (req, res) => {
  const parsed = z.object({ name: z.string().min(2).optional(), description: z.string().min(3).optional(), weight: z.number().min(0).max(100).optional(), enabled: z.boolean().optional(), configuration: z.record(z.unknown()).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: "Invalid rule update", details: parsed.error.flatten() });
  const rule = await FraudRule.findByIdAndUpdate(String(req.params.id), { ...parsed.data, updatedBy: req.user!.id }, { new: true, runValidators: true });
  if (!rule) return res.status(404).json({ success: false, error: "Rule not found" });
  await audit(req.user?.id, "rule.updated", "FraudRule", String(rule._id), parsed.data);
  const transactions = await Transaction.find().select("_id");
  for (const transaction of transactions) await evaluateAndAlert(String(transaction._id));
  res.json({ success: true, data: rule });
}));

router.get("/investigations", authenticate, asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await Investigation.find().populate("transaction").populate("assignedTo", "name email").sort({ updatedAt: -1 }).limit(200) });
}));
router.get("/investigations/transaction/:transactionId", authenticate, asyncHandler(async (req, res) => {
  const id = String(req.params.transactionId);
  const transaction = await Transaction.findOne({ $or: [...(mongoose.isValidObjectId(id) ? [{ _id: id }] : []), { transactionId: id }] }).select("_id");
  if (!transaction) return res.status(404).json({ success: false, error: "Transaction not found" });
  const investigation = await Investigation.findOne({ transaction: transaction._id }).populate("transaction").populate("assignedTo", "name email");
  res.json({ success: true, data: investigation });
}));
router.post("/investigations/transaction/:transactionId/notes", authenticate, allowRoles("admin", "analyst"), asyncHandler(async (req, res) => {
  const parsed = z.object({ body: z.string().trim().min(1).max(4000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: "Note must contain 1–4000 characters" });
  const id = String(req.params.transactionId);
  const transaction = await Transaction.findOne({ $or: [...(mongoose.isValidObjectId(id) ? [{ _id: id }] : []), { transactionId: id }] });
  if (!transaction) return res.status(404).json({ success: false, error: "Transaction not found" });
  const latestAlert = await Alert.findOne({ transaction: transaction._id }).sort({ createdAt: -1 });
  const investigation = await Investigation.findOneAndUpdate(
    { transaction: transaction._id },
    { $setOnInsert: { transaction: transaction._id, alert: latestAlert?._id ?? null, status: transaction.status } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  investigation.notes.push({ author: new mongoose.Types.ObjectId(req.user!.id), body: parsed.data.body, createdAt: new Date() } as never);
  await investigation.save();
  await audit(req.user?.id, "investigation.note_added", "Investigation", String(investigation._id), { transactionId: transaction.transactionId });
  res.status(201).json({ success: true, data: investigation });
}));
router.post("/investigations/:id/notes", authenticate, allowRoles("admin", "analyst"), asyncHandler(async (req, res) => {
  const parsed = z.object({ body: z.string().trim().min(1).max(4000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: "Note must contain 1–4000 characters" });
  const investigation = await Investigation.findById(String(req.params.id));
  if (!investigation) return res.status(404).json({ success: false, error: "Investigation not found" });
  investigation.notes.push({ author: new (await import("mongoose")).default.Types.ObjectId(req.user!.id), body: parsed.data.body, createdAt: new Date() } as never);
  await investigation.save();
  await audit(req.user?.id, "investigation.note_added", "Investigation", String(investigation._id));
  res.status(201).json({ success: true, data: investigation });
}));

router.get("/analytics/overview", authenticate, asyncHandler(async (_req, res) => {
  const [totalTransactions, totals, highRisk, openAlerts, confirmedFraud, falsePositives] = await Promise.all([
    Transaction.countDocuments(),
    Transaction.aggregate([{ $group: {
      _id: "$currency",
      totalVolume: { $sum: "$amount" },
      flaggedVolume: { $sum: { $cond: [{ $gte: ["$riskScore", 50] }, "$amount", 0] } }
    } }]),
    Transaction.countDocuments({ riskLevel: { $in: ["High", "Critical"] } }),
    Alert.countDocuments({ status: { $in: ["Open", "Reviewing"] } }),
    Investigation.countDocuments({ decision: "Confirmed Fraud" }),
    Investigation.countDocuments({ decision: "Legitimate Activity" })
  ]);
  res.json({ success: true, data: {
    totalTransactions,
    volumeByCurrency: totals.map((bucket: { _id: string; totalVolume: number; flaggedVolume: number }) => ({
      currency: bucket._id,
      totalVolume: bucket.totalVolume,
      flaggedVolume: bucket.flaggedVolume
    })),
    highRisk, openAlerts, confirmedFraud, falsePositives
  } });
}));
router.get("/analytics/risk-distribution", authenticate, asyncHandler(async (_req, res) => {
  const data = await Transaction.aggregate([{ $group: { _id: "$riskLevel", count: { $sum: 1 } } }, { $project: { _id: 0, riskLevel: "$_id", count: 1 } }]);
  res.json({ success: true, data });
}));
router.get("/analytics/activity", authenticate, asyncHandler(async (req, res) => {
  const range = z.enum(["24h", "7d", "30d"]).safeParse(req.query.range ?? "7d");
  if (!range.success) return res.status(400).json({ success: false, error: "Range must be 24h, 7d, or 30d" });
  const now = new Date();
  const hours = range.data === "24h";
  const start = new Date(now.getTime() - (hours ? 24 : range.data === "7d" ? 7 : 30) * (hours ? 60 * 60_000 : 24 * 60 * 60_000));
  const dateFormat = hours ? "%Y-%m-%dT%H:00:00.000Z" : "%Y-%m-%dT00:00:00.000Z";
  const data = await Transaction.aggregate([
    { $match: { timestamp: { $gte: start, $lte: now } } },
    { $group: {
      _id: { $dateToString: { format: dateFormat, date: "$timestamp", timezone: "UTC" } },
      transactions: { $sum: 1 },
      alerts: { $sum: { $cond: [{ $gte: ["$riskScore", 50] }, 1, 0] } },
      volume: { $sum: "$amount" }
    } },
    { $project: { _id: 0, date: "$_id", transactions: 1, alerts: 1, volume: 1 } },
    { $sort: { date: 1 } }
  ]);
  res.json({ success: true, data });
}));
router.get("/audit-logs", authenticate, allowRoles("admin"), asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await AuditLog.find().populate("actor", "name email").sort({ createdAt: -1 }).limit(200) });
}));

export default router;
