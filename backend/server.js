import express from "express";
import cors from "cors";
import pkg from "pg";
const { Pool } = pkg;

const PORT = process.env.PORT || 10000;
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN || "https://Nijon435.github.io";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "false"
      ? false
      : { rejectUnauthorized: false },
});

const app = express();
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

// Health
app.get("/api/health", (req, res) => res.json({ ok: true }));

// Example read endpoint (employees)
app.get("/api/employees", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM employees ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Example write endpoint (create order)
app.post("/api/orders", async (req, res) => {
  const { customer, items, total } = req.body;
  try {
    const q =
      "INSERT INTO orders(customer, items, total, status, timestamp) VALUES($1,$2,$3,$4,now()) RETURNING *";
    const values = [customer, items, total, "pending"];
    const result = await pool.query(q, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Insert failed" });
  }
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
