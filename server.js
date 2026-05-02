const express = require("express");
const cors = require("cors");
const db = require("./db");
const bcrypt = require("bcrypt");

const app = express();

app.use(cors());
app.use(express.json());

// ================= DOCTORS =================
app.get("/api/doctors", (req, res) => {
  const search = req.query.search || "";

  const sql = `
    SELECT * FROM doctors 
    WHERE name LIKE ? OR specialty LIKE ? OR city LIKE ?
    ORDER BY id DESC
  `;

  const val = `%${search}%`;

  db.query(sql, [val, val, val], (err, result) => {
    if (err) return res.status(500).json({ message: "Error fetching doctors" });
    res.json(result);
  });
});

// ================= REGISTER =================
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const hash = await bcrypt.hash(password, 10);

    db.query(
      "INSERT INTO users (name,email,password) VALUES (?,?,?)",
      [name, email, hash],
      (err) => {
        if (err) return res.status(400).json({ message: "User exists" });
        res.json({ message: "Registered" });
      }
    );
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ================= LOGIN =================
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email=?", [email], async (err, r) => {
    if (err) return res.status(500).json({ message: "Server error" });

    if (!r.length) return res.status(400).json({ message: "User not found" });

    const user = r[0];
    const ok = await bcrypt.compare(password, user.password);

    if (!ok) return res.status(400).json({ message: "Wrong password" });

    res.json({
      user: { id: user.id, name: user.name, email: user.email }
    });
  });
});

// ================= BOOK APPOINTMENT =================
app.post("/api/appointments", (req, res) => {
  const {
    doctor,
    doctor_id,
    patientName,
    patientPhone,
    appointmentDate,
    appointmentTime,
    problem,
    email
  } = req.body;

  if (!doctor_id || !appointmentDate || !appointmentTime) {
    return res.status(400).json({ message: "Missing data" });
  }

  const sql = `
    INSERT INTO appointments 
    (doctor_id, doctor_name, patient_name, phone, date, slot, problem, email)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      doctor_id,
      doctor,
      patientName,
      patientPhone,
      appointmentDate,
      appointmentTime,
      problem,
      email
    ],
    (err) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "Booking failed" });
      }

      res.json({ message: "Appointment booked successfully" });
    }
  );
});

// ================= MY APPOINTMENTS =================
app.get("/api/my-appointments", (req, res) => {
  const email = req.query.email;

  db.query(
    "SELECT * FROM appointments WHERE email=? ORDER BY date DESC",
    [email],
    (err, r) => {
      if (err) return res.status(500).json({ message: "Error" });
      res.json(r);
    }
  );
});

// ================= CANCEL =================
app.delete("/api/appointments/:id", (req, res) => {
  const { id } = req.params;
  const { email } = req.query;

  db.query(
    "DELETE FROM appointments WHERE id=? AND email=?",
    [id, email],
    (err, r) => {
      if (err) return res.status(500).json({ message: "Cancel failed" });

      if (!r.affectedRows)
        return res.status(404).json({ message: "Not found" });

      res.json({ message: "Cancelled" });
    }
  );
});

// ================= SUBSCRIBE (FIXED) =================
app.post("/api/subscribe", (req, res) => {
  const { email, planName } = req.body;

  const plans = { Basic: 2, Pro: 4, Family: 8 };
  const credits = plans[planName];

  if (!credits) return res.status(400).json({ message: "Invalid plan" });

  // 🔥 IMPORTANT FIX:
  // पहले पुराने plans deactivate करो
  db.query(
    "UPDATE subscriptions SET status='expired' WHERE email=?",
    [email],
    (err) => {
      if (err) return res.status(500).json({ message: "Update failed" });

      // नया plan insert करो
      db.query(
        `INSERT INTO subscriptions (email,plan_name,total_credits,used_credits,status)
         VALUES (?,?,?,?, 'active')`,
        [email, planName, credits, 0],
        (err2) => {
          if (err2) return res.status(500).json({ message: "Subscribe failed" });
          res.json({ message: "Plan activated" });
        }
      );
    }
  );
});

// ================= NEARBY DOCTORS =================
app.get("/api/nearby-doctors", (req, res) => {
  const { lat, lng } = req.query;

  // फिलहाल simple fallback (distance logic बाद में)
  db.query("SELECT * FROM doctors", (err, result) => {
    if (err) return res.status(500).json({ message: "Error" });
    res.json(result);
  });
});

// ================= VIDEO CALL =================
app.post("/api/video-call/authorize", (req, res) => {
  const { email, appointmentId, doctorId } = req.body;

  // 🔍 Step 1: check existing session
  db.query(
    "SELECT * FROM video_sessions WHERE appointment_id=?",
    [appointmentId],
    (err, existing) => {

      if (err) return res.status(500).json({ message: "Server error" });

      // ✅ अगर session already है → credit मत काटो
      if (existing.length) {
        return res.json({ roomId: existing[0].room_id });
      }

      // 🔍 Step 2: check active plan
      db.query(
        `SELECT * FROM subscriptions 
         WHERE email=? AND status='active'
         LIMIT 1`,
        [email],
        (err2, sub) => {

          if (err2) return res.status(500).json({ message: "Server error" });

          if (!sub.length)
            return res.status(403).json({ message: "No active plan" });

          const current = sub[0];

          if (current.used_credits >= current.total_credits)
            return res.status(403).json({ message: "No credits left" });

          const roomId = `room_${appointmentId}_${doctorId}`;

          // ✅ Step 3: insert session
          db.query(
            "INSERT INTO video_sessions (email,appointment_id,doctor_id,room_id) VALUES (?,?,?,?)",
            [email, appointmentId, doctorId, roomId],
            (err3) => {

              if (err3)
                return res.status(500).json({ message: "Session error" });

              // ✅ Step 4: credit cut ONLY ONCE
              db.query(
                "UPDATE subscriptions SET used_credits = used_credits + 1 WHERE id=?",
                [current.id]
              );

              res.json({ roomId });
            }
          );
        }
      );
    }
  );
});

// ================= START =================
app.listen(5000, () => console.log("Server running 🚀"));