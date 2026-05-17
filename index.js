import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb"; 

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));

app.use(express.json());


const client = new MongoClient(process.env.MONGODB_URI);

async function run() {
  try {
    await client.connect();
    console.log("MongoDB Connected!");

    const db = client.db("docappoint");
    const doctorsCollection = db.collection("doctors");

    
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
        const query = { _id: new ObjectId(id) };
        const result = await doctorsCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error fetching doctor details:", error);
        res.status(500).send({ message: "Failed to fetch doctor details" });
      }
    });

    app.listen(5000, () => {
      console.log("Server running on port 5000");
    });

  } catch (error) {
    console.log(error);
  }
}

run();