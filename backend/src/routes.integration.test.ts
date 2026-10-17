import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { connectDatabase } from "./config/db.js";
import { Alert, FraudRule, Investigation, Transaction, User } from "./models.js";

const app = createApp();
let mongo: MongoMemoryServer;
let token = "";

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.JWT_SECRET = "integration-test-secret-with-sufficient-entropy";
  await connectDatabase(mongo.getUri());
  await Promise.all([User.init(), FraudRule.init(), Transaction.init(), Alert.init(), Investigation.init()]);
  await User.create({
    name: "Integration Analyst",
    email: "analyst@example.test",
    passwordHash: await bcrypt.hash("TestPassword123!", 4),
    role: "admin"
  });
  await FraudRule.create([
    { name: "High amount", description: "Amount threshold", ruleType: "high_amount", weight: 25, enabled: true },
    { name: "Rapid activity", description: "Velocity threshold", ruleType: "rapid_activity", weight: 25, enabled: true },
    { name: "Unusual hour", description: "UTC hour threshold", ruleType: "unusual_hour", weight: 10, enabled: true },
    { name: "New recipient", description: "First recipient", ruleType: "new_recipient", weight: 15, enabled: true },
    { name: "Account behavior", description: "Behavior heuristic", ruleType: "account_behavior", weight: 25, enabled: true }
  ]);
  const login = await request(app).post("/api/v1/auth/login")
    .send({ email: "analyst@example.test", password: "TestPassword123!" })
    .expect(200);
  token = login.body.data.token as string;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("transaction-to-investigation workflow", () => {
  it("registers a public analyst account and rejects duplicate email addresses", async () => {
    const registration = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "New Analyst", email: "new-analyst@example.test", password: "SafePassword123!" })
      .expect(201);

    expect(registration.body.data.user).toMatchObject({
      name: "New Analyst",
      email: "new-analyst@example.test",
      role: "analyst"
    });
    expect(registration.body.data.token).toEqual(expect.any(String));
    expect(registration.body.data.user.passwordHash).toBeUndefined();
    const registeredUser = await User.findOne({ email: "new-analyst@example.test" }).select("+passwordHash");
    expect(registeredUser?.passwordHash).not.toBe("SafePassword123!");
    expect(await bcrypt.compare("SafePassword123!", registeredUser!.passwordHash)).toBe(true);

    await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Duplicate Analyst", email: "new-analyst@example.test", password: "SafePassword123!" })
      .expect(409);
  });

  it("creates, scores, alerts, investigates, updates, and persists a transaction", async () => {
    const created = await request(app)
      .post("/api/v1/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        transactionId: "TX-INTEGRATION-001",
        customerId: "C-TEST",
        customerName: "Test Customer",
        accountId: "ACC-TEST",
        amount: 6800,
        currency: "USD",
        merchantName: "Test Recipient",
        recipientId: "REC-TEST",
        channel: "Bank Transfer",
        transactionType: "Payment",
        timestamp: "2026-10-17T02:00:00.000Z",
        isNewRecipient: true
      })
      .expect(201);

    expect(created.body.data.riskScore).toBe(50);
    expect(created.body.data.riskLevel).toBe("High");
    const transactionId = created.body.data._id as string;
    const transactionIdLabel = created.body.data.transactionId as string;

    const persisted = await Transaction.findById(transactionId);
    expect(persisted?.riskScore).toBe(50);
    expect(await Alert.countDocuments({ transaction: transactionId })).toBe(1);
    expect(await Investigation.countDocuments({ transaction: transactionId })).toBe(1);

    const alertResponse = await request(app)
      .get("/api/v1/alerts")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(alertResponse.body.data.items).toHaveLength(1);

    await request(app)
      .post(`/api/v1/investigations/transaction/${transactionIdLabel}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "Reviewed recipient details and confirmed analyst follow-up." })
      .expect(201);

    await request(app)
      .patch(`/api/v1/transactions/${transactionIdLabel}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "Reviewing" })
      .expect(200);

    const details = await request(app)
      .get(`/api/v1/investigations/transaction/${transactionIdLabel}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(details.body.data.status).toBe("Reviewing");
    expect(details.body.data.notes[0].body).toContain("confirmed analyst follow-up");

    await request(app)
      .patch(`/api/v1/transactions/${transactionIdLabel}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "False Positive" })
      .expect(200);

    const finalTransaction = await Transaction.findById(transactionId);
    const finalInvestigation = await Investigation.findOne({ transaction: transactionId });
    const finalAlert = await Alert.findOne({ transaction: transactionId });
    expect(finalTransaction?.status).toBe("False Positive");
    expect(finalInvestigation?.status).toBe("False Positive");
    expect(finalInvestigation?.decision).toBe("Legitimate Activity");
    expect(finalAlert?.status).toBe("False Positive");

    const overview = await request(app)
      .get("/api/v1/analytics/overview")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(overview.body.data.totalTransactions).toBe(1);
    expect(overview.body.data.highRisk).toBe(1);
    expect(overview.body.data.openAlerts).toBe(0);
    expect(overview.body.data.volumeByCurrency).toEqual([
      { currency: "USD", totalVolume: 6800, flaggedVolume: 6800 }
    ]);

    const activity = await request(app)
      .get("/api/v1/analytics/activity?range=7d")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(activity.body.data).toEqual([
      expect.objectContaining({ transactions: 1, alerts: 1, volume: 6800 })
    ]);

    const amountRule = await FraudRule.findOne({ ruleType: "high_amount" });
    const updatedRule = await request(app)
      .patch(`/api/v1/rules/${String(amountRule?._id)}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ weight: 20 })
      .expect(200);
    expect(updatedRule.body.data.weight).toBe(20);
    const rescored = await Transaction.findById(transactionId);
    expect(rescored?.riskScore).toBe(45);
    expect(rescored?.riskLevel).toBe("Medium");
  });
});
