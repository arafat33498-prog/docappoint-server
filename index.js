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

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

async function run() {
    try {
        await client.connect();
        console.log("MongoDB Connected Successfully 🚀");

        const db = client.db("docappoint");
        const doctorsCollection = db.collection("doctors");
        const bookingsCollection = db.collection("bookings");

        const auth = betterAuth({
            database: mongodbAdapter(db),
            emailAndPassword: { enabled: true },
            trustedOrigins: [process.env.CLIENT_URL],
            advanced: {
                trustHost: true,
                cookieOptions: {
                    secure: true,
                    sameSite: "none",
                },
            },
        });

        // Better Auth API Route
        app.all("/api/auth/*", (req, res) => {
            toNodeHandler(auth)(req, res);
        });

        // Doctors Routes
        app.get("/doctors", async (req, res) => {
            const result = await doctorsCollection.find().toArray();
            res.send(result);
        });

        app.get("/doctors/:id", async (req, res) => {
            const result = await doctorsCollection.findOne({ _id: new ObjectId(req.params.id) });
            res.send(result);
        });

        // Bookings Routes
        app.post("/bookings", async (req, res) => {
            const result = await bookingsCollection.insertOne(req.body);
            res.status(201).send({ success: true, insertedId: result.insertedId });
        });

        app.get("/bookings", async (req, res) => {
            const email = req.query.email;
            const query = email ? { userEmail: email } : {};
            const result = await bookingsCollection.find(query).toArray();
            res.send(result);
        });

        app.put("/bookings/:id", async (req, res) => {
            const data = req.body;
            const result = await bookingsCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { 
                    patientName: data.patientName, 
                    phone: data.phone, 
                    appointmentDate: data.appointmentDate, 
                    timeSlot: data.timeSlot || data.appointmentTime 
                } }
            );
            res.send(result);
        });

        app.delete("/bookings/:id", async (req, res) => {
            const result = await bookingsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
            res.send(result);
        });

        app.listen(port, () => console.log(`Server running on port ${port}`));
    } catch (error) {
        console.error("DB Connection Error:", error);
    }
}

run();