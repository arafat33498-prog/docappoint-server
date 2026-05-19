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

// আপডেট করা CORS কনফিগারেশন
app.use(cors({
  origin: [
    "http://localhost:3000", 
    "http://127.0.0.1:3000",
    "https://docappoint-client-server.vercel.app" 
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

async function run() {
  try {
    await client.connect();
    console.log("MongoDB Connected Successfully! 🚀");

    const db = client.db("docappoint");
    const doctorsCollection = db.collection("doctors");
    const bookingsCollection = db.collection("bookings");

    const auth = betterAuth({
      database: mongodbAdapter(db), 
      emailAndPassword: {  
        enabled: true, 
      },
      // আপডেট করা Trusted Origins
      trustedOrigins: [
        "http://localhost:3000", 
        "https://docappoint-client-server.vercel.app"
      ], 
      advanced: {
        trustHost: true
      }
    });

    app.all(/^\/api\/auth\/.*/, (req, res) => {
      toNodeHandler(auth)(req, res);
    });

    app.get("/", (req, res) => {
      res.send("DocAppoint Server Running");
    });

    // রাউটগুলো একই থাকছে
    app.get("/doctors", async (req, res) => {
      try {
        const result = await doctorsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch doctors" });
      }
    });

    app.get("/doctors/:id", async (req, res) => {
      try {
        const result = await doctorsCollection.findOne({ _id: new ObjectId(req.params.id) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch doctor details" });
      }
    });

    app.post("/bookings", async (req, res) => {
      try {
        const result = await bookingsCollection.insertOne(req.body);
        res.status(201).send({ success: true, insertedId: result.insertedId });
      } catch (error) {
        res.status(500).send({ message: "Failed to book" });
      }
    });

    app.get("/bookings", async (req, res) => {
      try {
        const email = req.query.email;
        const query = email ? { $or: [{ userEmail: email }, { email: email }] } : {};
        const result = await bookingsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch bookings" });
      }
    });

    app.patch("/bookings/:id", async (req, res) => {
      try {
        const result = await bookingsCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { status: req.body.status } });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update status" });
      }
    });

    app.put("/bookings/:id", async (req, res) => {
      try {
        const result = await bookingsCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: req.body });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update appointment" });
      }
    });

    app.delete("/bookings/:id", async (req, res) => {
      try {
        const result = await bookingsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete" });
      }
    });

  } catch (error) {
    console.error("Database Connection Error:", error);
  }
}

run();

app.listen(port, () => {
  console.log(`Server running smoothly on port ${port}`);
});