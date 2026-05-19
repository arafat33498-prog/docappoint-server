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

// ✅ REQUIRED for cookies in production (Render/Vercel)
app.set("trust proxy", 1);

// ======================
// CORS CONFIG (FIXED)
// ======================
app.use(
  cors({
    origin: process.env.CLIENT_URL, // must be exact Vercel URL
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// ======================
// MONGODB CONNECT
// ======================
const client = new MongoClient(process.env.MONGODB_URI);

async function run() {
  try {
    await client.connect();
    console.log("MongoDB Connected Successfully 🚀");

    const db = client.db("docappoint");

    const doctorsCollection = db.collection("doctors");
    const bookingsCollection = db.collection("bookings");

    // ======================
    // BETTER AUTH (FIXED)
    // ======================
    const auth = betterAuth({
      database: mongodbAdapter(db),

      emailAndPassword: {
        enabled: true,
      },

      trustedOrigins: [process.env.CLIENT_URL],

      advanced: {
        trustHost: true,
        crossSubDomainCookies: {
          enabled: true,
        },
      },
    });

    // auth routes
    app.all(/^\/api\/auth\/.*/, (req, res) => {
      toNodeHandler(auth)(req, res);
    });

    // ======================
    // BASIC ROUTE
    // ======================
    app.get("/", (req, res) => {
      res.send("DocAppoint Server Running 🚀");
    });

    // ======================
    // DOCTORS
    // ======================
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
        const result = await doctorsCollection.findOne({
          _id: new ObjectId(req.params.id),
        });

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch doctor details" });
      }
    });

    // ======================
    // BOOKINGS
    // ======================
    app.post("/bookings", async (req, res) => {
      try {
        const result = await bookingsCollection.insertOne(req.body);

        res.status(201).send({
          success: true,
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({ message: "Failed to create booking" });
      }
    });

    app.get("/bookings", async (req, res) => {
      try {
        const email = req.query.email;

        const query = email
          ? {
              $or: [{ userEmail: email }, { email: email }],
            }
          : {};

        const result = await bookingsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch bookings" });
      }
    });

    app.patch("/bookings/:id", async (req, res) => {
      try {
        const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { status: req.body.status } }
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update status" });
      }
    });

    app.put("/bookings/:id", async (req, res) => {
      try {
        const data = req.body;

        const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          {
            $set: {
              patientName: data.patientName,
              gender: data.gender || "Male",
              phone: data.phone,
              appointmentDate: data.appointmentDate,
              appointmentTime: data.appointmentTime || data.timeSlot,
              timeSlot: data.timeSlot || data.appointmentTime,
            },
          }
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update booking" });
      }
    });

    app.delete("/bookings/:id", async (req, res) => {
      try {
        const result = await bookingsCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete booking" });
      }
    });
  } catch (error) {
    console.error("DB Connection Error:", error);
  }
}

run();

// ======================
// START SERVER
// ======================
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});