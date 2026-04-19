const express = require("express");
const router = express.Router();
const db = require("../db");

// BOOK APPOINTMENT API
router.post("/", (req, res) => {
  const { doctor, patientName, patientPhone, appointmentDate, appointmentTime, problem } = req.body;

  const sql = `
    INSERT INTO appointments 
    (doctor_name, patient_name, phone, date, time, problem)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [doctor, patientName, patientPhone, appointmentDate, appointmentTime, problem],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Error booking appointment" });
      }

      res.json({
        message: "Appointment booked successfully"
      });
    }
  );
});

module.exports = router;