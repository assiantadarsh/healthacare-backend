const express = require("express");
const cors = require("cors");
const db = require("./db");
const bcrypt = require("bcrypt");
require("dotenv").config();

const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= SEARCH DOCTORS =================
app.get("/api/doctors", (req, res) => {
  const search = req.query.search || "";

  const sql = `
    SELECT * FROM doctors 
    WHERE name LIKE ? 
    OR specialty LIKE ? 
    OR city LIKE ?
  `;

  const value = `%${search}%`;

  db.query(sql, [value, value, value], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Error fetching doctors" });
    }
    res.json(result);
  });
});

// ================= NEARBY DOCTORS =================
app.get("/api/nearby-doctors", (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ message: "Location required" });
  }

  const query = `
    SELECT *, 
    (6371 * acos(
      cos(radians(?)) * cos(radians(latitude)) *
      cos(radians(longitude) - radians(?)) +
      sin(radians(?)) * sin(radians(latitude))
    )) AS distance
    FROM doctors
    HAVING distance < 50
    ORDER BY distance
  `;

  db.query(query, [lat, lng, lat], (err, results) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Server error" });
    }

    res.json(results);
  });
});

// ================= REGISTER =================
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";

    db.query(sql, [name, email, hashedPassword], (err) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "User already exists" });
      }

      res.json({ message: "Registration successful" });
    });

  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ================= LOGIN =================
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const sql = "SELECT * FROM users WHERE email = ?";

  db.query(sql, [email], async (err, result) => {
    if (err) return res.status(500).json({ message: "Server error" });

    if (result.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = result[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Wrong password" });
    }

    res.json({ message: "Login successful", user });
  });
});

// ================= BOOK APPOINTMENT =================
app.post("/api/appointments", (req, res) => {
  const {
    doctor,
    patientName,
    patientPhone,
    appointmentDate,
    appointmentTime,
    problem,
    email
  } = req.body;

  const sql = `
    INSERT INTO appointments 
    (doctor_name, patient_name, phone, date, time, problem, email) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [doctor, patientName, patientPhone, appointmentDate, appointmentTime, problem, email],
    (err) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Booking failed" });
      }

      res.json({ message: "Appointment booked successfully" });
    }
  );
});

// ================= MY APPOINTMENTS (🔥 MAIN FEATURE) =================
// app.get("/api/my-appointments", (req, res) => {
//   const email = req.query.email;

//   const sql = "SELECT * FROM appointments WHERE email = ? ORDER BY date DESC";

//   db.query(sql, [email], (err, result) => {
//     if (err) {
//       console.log(err);
//       return res.status(500).json({ message: "Error fetching appointments" });
//     }

//     res.json(result);
//   });
// });
app.get("/api/my-appointments", (req, res) => {
  const email = req.query.email;

  const sql = "SELECT * FROM appointments WHERE email = ? ORDER BY date DESC";

  db.query(sql, [email], (err, result) => {
    if (err) {
      console.log(err);  // 👈 important
      return res.status(500).json(err);
    }

    res.json(result);
  });
});

// ================= TEST =================
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

// ================= SERVER START =================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});