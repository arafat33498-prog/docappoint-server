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
  origin: [process.env.CLIENT_URL],
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

      trustedOrigins: [process.env.CLIENT_URL],

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

    app.get("/doctors", async (req, res) => {
      try {
        const result = await doctorsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching doctors:", error);
        res.status(500).send({ message: "Failed to fetch doctors data" });
      }
    });

    app.get("/doctors/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const query = {
          _id: new ObjectId(id)
        };

        const result = await doctorsCollection.findOne(query);

        res.send(result);

      } catch (error) {
        console.error("Error fetching doctor details:", error);
        res.status(500).send({ message: "Failed to fetch doctor details" });
      }
    });

    app.post("/bookings", async (req, res) => {
      try {
        const bookingData = req.body;

        const result = await bookingsCollection.insertOne(bookingData);

        res.status(201).send({
          success: true,
          insertedId: result.insertedId
        });

      } catch (error) {
        console.error("Error creating booking:", error);
        res.status(500).send({ message: "Failed to complete the booking" });
      }
    });

    app.get("/bookings", async (req, res) => {
      try {
        const email = req.query.email;

        let query = {};

        if (email) {
          query = {
            $or: [
              { userEmail: email },
              { email: email }
            ]
          };
        }

        const result = await bookingsCollection.find(query).toArray();

        res.send(result);

      } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).send({ message: "Failed to fetch bookings data" });
      }
    });

    app.patch("/bookings/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const { status } = req.body;

        const query = {
          _id: new ObjectId(id)
        };

        const updateDoc = {
          $set: {
            status: status
          },
        };

        const result = await bookingsCollection.updateOne(query, updateDoc);

        res.send(result);

      } catch (error) {
        console.error("Error updating booking status:", error);
        res.status(500).send({ message: "Failed to update booking status" });
      }
    });

    app.put("/bookings/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const updatedData = req.body;

        const query = {
          _id: new ObjectId(id)
        };

        const updateDoc = {
          $set: {
            patientName: updatedData.patientName,
            gender: updatedData.gender || "Male",
            phone: updatedData.phone,
            appointmentDate: updatedData.appointmentDate,
            appointmentTime:
              updatedData.appointmentTime || updatedData.timeSlot,
            timeSlot:
              updatedData.timeSlot || updatedData.appointmentTime,
          },
        };

        const result = await bookingsCollection.updateOne(query, updateDoc);

        res.send(result);

      } catch (error) {
        console.error("Error updating booking:", error);
        res.status(500).send({ message: "Failed to update appointment" });
      }
    });

    app.delete("/bookings/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const query = {
          _id: new ObjectId(id)
        };

        const result = await bookingsCollection.deleteOne(query);

        res.send(result);

      } catch (error) {
        console.error("Error deleting booking:", error);
        res.status(500).send({ message: "Failed to delete appointment" });
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