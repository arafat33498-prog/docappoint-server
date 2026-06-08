import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { toNodeHandler } from "better-auth/node";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.set("trust proxy", 1);
app.use(express.json());

// CORS Configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const client = new MongoClient(process.env.MONGODB_URI);

async function run() {
  try {
    await client.connect();
    console.log("MongoDB Connected Successfully 🚀");

    const db = client.db("docappoint");

    // Better Auth Setup
    const auth = betterAuth({
      database: mongodbAdapter(db),
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: process.env.BETTER_AUTH_URL,
      emailAndPassword: { enabled: true },
    });

    // Better Auth Routes - Fix for path-to-regexp error
    app.all("/api/auth/:action", (req, res) => {
      return toNodeHandler(auth)(req, res);
    });

    // Auth Middleware
    const authMiddleware = async (req, res, next) => {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      req.user = session.user;
      next();
    };

    // Public Routes
    app.get("/", (req, res) => res.send("DocAppoint Server is running!"));

    app.get("/doctors", async (req, res) => {
      const result = await db.collection("doctors").find().toArray();
      res.send(result);
    });

    app.get("/doctors/:id", async (req, res) => {
      try {
        const result = await db.collection("doctors").findOne({ _id: new ObjectId(req.params.id) });
        result ? res.send(result) : res.status(404).send({ message: "Doctor not found" });
      } catch (e) { res.status(400).send({ message: "Invalid ID" }); }
    });

    // Protected Routes
    app.post("/bookings", authMiddleware, async (req, res) => {
      const booking = { ...req.body, userEmail: req.user.email, createdAt: new Date() };
      const result = await db.collection("bookings").insertOne(booking);
      res.status(201).send({ success: true, insertedId: result.insertedId });
    });

    app.get("/bookings", authMiddleware, async (req, res) => {
      const result = await db.collection("bookings").find({ userEmail: req.user.email }).toArray();
      res.send(result);
    });

    app.patch("/bookings/:id", authMiddleware, async (req, res) => {
      try {
        const result = await db.collection("bookings").updateOne(
          { _id: new ObjectId(req.params.id), userEmail: req.user.email },
          { $set: { status: req.body.status, updatedAt: new Date() } }
        );
        result.matchedCount > 0 ? res.send({ success: true }) : res.status(404).send({ message: "Not found" });
      } catch (e) { res.status(400).send({ message: "Invalid ID" }); }
    });

    app.delete("/bookings/:id", authMiddleware, async (req, res) => {
      try {
        const result = await db.collection("bookings").deleteOne({ 
          _id: new ObjectId(req.params.id), 
          userEmail: req.user.email 
        });
        result.deletedCount > 0 ? res.send({ success: true }) : res.status(404).send({ message: "Not found" });
      } catch (e) { res.status(400).send({ message: "Invalid ID" }); }
    });

  } catch (error) {
    console.error("DB Connection Error:", error);
  }
}

run();

app.listen(port, () => console.log(`Server running on port ${port}`));