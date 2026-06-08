import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.set("trust proxy", 1);

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(cookieParser());

const client = new MongoClient(process.env.MONGODB_URI);

async function run() {
  try {
    await client.connect();
    console.log("MongoDB Connected Successfully 🚀");

    const db = client.db("docappoint");

    const doctorsCollection = db.collection("doctors");
    const bookingsCollection = db.collection("bookings");
    const usersCollection = db.collection("users");

    // ROOT
    app.get("/", (req, res) => {
      res.send("DocAppoint Server Running 🚀");
    });

    // =========================
    // REGISTER
    // =========================
    app.post("/register", async (req, res) => {
      try {
        const { name, email, password, image } = req.body;

        const existingUser = await usersCollection.findOne({ email });

        if (existingUser) {
          return res.status(400).send({
            success: false,
            message: "User already exists",
          });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = {
          name,
          email,
          password: hashedPassword,
          image,
        };

        await usersCollection.insertOne(user);

        res.send({
          success: true,
          message: "Registration successful",
        });

      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Registration failed",
        });
      }
    });

    // =========================
    // LOGIN
    // =========================
    app.post("/login", async (req, res) => {
      try {
        const { email, password } = req.body;

        const user = await usersCollection.findOne({ email });

        if (!user) {
          return res.status(400).send({
            success: false,
            message: "Invalid email",
          });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
          return res.status(400).send({
            success: false,
            message: "Invalid password",
          });
        }

        const token = jwt.sign(
          {
            email: user.email,
          },
          process.env.JWT_SECRET,
          {
            expiresIn: "7d",
          }
        );

        res.cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        });

        res.send({
          success: true,
          user: {
            name: user.name,
            email: user.email,
            image: user.image,
          },
        });

      } catch (error) {
        console.error(error);

        res.status(500).send({
          success: false,
          message: "Login failed",
        });
      }
    });

    // =========================
    // LOGOUT
    // =========================
    app.post("/logout", (req, res) => {
      res.clearCookie("token", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });

      res.send({
        success: true,
      });
    });

    // =========================
    // CURRENT USER
    // =========================
    app.get("/me", async (req, res) => {
      try {
        const token = req.cookies.token;

        if (!token) {
          return res.send(null);
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await usersCollection.findOne({
          email: decoded.email,
        });

        if (!user) {
          return res.send(null);
        }

        res.send({
          name: user.name,
          email: user.email,
          image: user.image,
        });

      } catch (error) {
        console.error(error);
        res.send(null);
      }
    });

    // =========================
    // DOCTORS
    // =========================
    app.get("/doctors", async (req, res) => {
      try {
        const result = await doctorsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Failed to fetch doctors",
        });
      }
    });

    app.get("/doctors/:id", async (req, res) => {
      try {
        const result = await doctorsCollection.findOne({
          _id: new ObjectId(req.params.id),
        });

        res.send(result);

      } catch (error) {
        res.status(500).send({
          message: "Failed to fetch doctor details",
        });
      }
    });

    // =========================
    // BOOKINGS
    // =========================
    app.post("/bookings", async (req, res) => {
      try {
        const result = await bookingsCollection.insertOne(req.body);

        res.status(201).send({
          success: true,
          insertedId: result.insertedId,
        });

      } catch (error) {
        res.status(500).send({
          message: "Failed to create booking",
        });
      }
    });

    app.get("/bookings", async (req, res) => {
      try {
        const email = req.query.email;

        const query = email
          ? {
              $or: [
                { userEmail: email },
                { email: email },
              ],
            }
          : {};

        const result = await bookingsCollection.find(query).toArray();

        res.send(result);

      } catch (error) {
        res.status(500).send({
          message: "Failed to fetch bookings",
        });
      }
    });

    app.patch("/bookings/:id", async (req, res) => {
      try {
        const result = await bookingsCollection.updateOne(
          {
            _id: new ObjectId(req.params.id),
          },
          {
            $set: {
              status: req.body.status,
            },
          }
        );

        res.send(result);

      } catch (error) {
        res.status(500).send({
          message: "Failed to update status",
        });
      }
    });

    app.put("/bookings/:id", async (req, res) => {
      try {
        const data = req.body;

        const result = await bookingsCollection.updateOne(
          {
            _id: new ObjectId(req.params.id),
          },
          {
            $set: {
              patientName: data.patientName,
              gender: data.gender || "Male",
              phone: data.phone,
              appointmentDate: data.appointmentDate,
              appointmentTime:
                data.appointmentTime || data.timeSlot,
              timeSlot:
                data.timeSlot || data.appointmentTime,
            },
          }
        );

        res.send(result);

      } catch (error) {
        res.status(500).send({
          message: "Failed to update booking",
        });
      }
    });

    app.delete("/bookings/:id", async (req, res) => {
      try {
        const result = await bookingsCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });

        res.send(result);

      } catch (error) {
        res.status(500).send({
          message: "Failed to delete booking",
        });
      }
    });

  } catch (error) {
    console.error("DB Connection Error:", error);
  }
}

run();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});