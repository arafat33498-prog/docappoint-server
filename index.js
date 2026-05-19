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

// ১. CORS কনফিগারেশন আপডেট
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true, // কুকি পাঠানোর জন্য অত্যাবশ্যক
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
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
                    secure: true, // প্রোডাকশনে অবশ্যই true
                    sameSite: "none", // ক্রস-ডোমেইন কুকির জন্য
                },
            },
        });

        // ২. Better Auth API Route
        app.all("/api/auth/*", (req, res) => {
            toNodeHandler(auth)(req, res);
        });

        // ৩. সেশন চেক করার জন্য একটি হেল্পার ফাংশন
        const isAuthenticated = async (req, res) => {
            const session = await auth.api.getSession({ headers: req.headers });
            if (!session) {
                res.status(401).send({ message: "Unauthorized" });
                return null;
            }
            return session;
        };

        // Doctors Routes
        app.get("/doctors", async (req, res) => {
            const result = await doctorsCollection.find().toArray();
            res.send(result);
        });

        app.get("/doctors/:id", async (req, res) => {
            const result = await doctorsCollection.findOne({ _id: new ObjectId(req.params.id) });
            res.send(result);
        });

        // Bookings Routes (সুরক্ষিত)
        app.post("/bookings", async (req, res) => {
            const session = await isAuthenticated(req, res);
            if (!session) return;
            
            const result = await bookingsCollection.insertOne(req.body);
            res.status(201).send({ success: true, insertedId: result.insertedId });
        });

        app.get("/bookings", async (req, res) => {
            const session = await isAuthenticated(req, res);
            if (!session) return;

            const email = req.query.email;
            // ইউজার শুধুমাত্র নিজের ডাটাই দেখতে পারবে
            if (session.user.email !== email) {
                return res.status(403).send({ message: "Forbidden" });
            }
            
            const result = await bookingsCollection.find({ userEmail: email }).toArray();
            res.send(result);
        });

        app.put("/bookings/:id", async (req, res) => {
            const session = await isAuthenticated(req, res);
            if (!session) return;

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
            const session = await isAuthenticated(req, res);
            if (!session) return;

            const result = await bookingsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
            res.send(result);
        });

        app.listen(port, () => console.log(`Server running on port ${port}`));
    } catch (error) {
        console.error("DB Connection Error:", error);
    }
}

run();