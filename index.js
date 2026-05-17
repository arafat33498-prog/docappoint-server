import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.send("DocAppoint Server Running");
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});