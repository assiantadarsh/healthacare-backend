const express = require("express");
const router = express.Router();
const db = require("../db");

// BOOK APPOINTMENT
router.post("/", (req, res) => {
  const {
    doctor,
    doctor_id,
    slot,
    patientName,
    patientPhone,
    appointmentDate,
    problem,
    email
  } = req.body;

  if (!doctor_id || !slot || !appointmentDate || !email) {
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
      slot,
      problem,
      email
    ],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Booking failed" });
      }

      res.json({ message: "Appointment booked successfully" });
    }
  );
});

module.exports = router;