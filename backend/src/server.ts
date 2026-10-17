import "dotenv/config";
import { createApp } from "./app.js";
import { connectDatabase } from "./config/db.js";

const port = Number(process.env.PORT || 5000);
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI must be set in .env");

await connectDatabase(uri);
const app = createApp();
const server = app.listen(port, () => console.log(`Fraud Radar API listening on http://localhost:${port}`));

async function shutdown() {
  server.close(async () => {
    const mongoose = await import("mongoose");
    await mongoose.default.disconnect();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
