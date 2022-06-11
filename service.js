const express = require("express");
const nodemailer = require("nodemailer");
const config = require("./config/index")[process.env.NODE_ENV || "development"];
const router = express.Router();

const log = config.log();

const transporter = nodemailer.createTransport({
	service: "Gmail",
	auth: {
		user: process.env.USER,
		pass: process.env.PASSWORD,
	},
	tls: {
		rejectUnauthorized: false,
	},
	ignoreTLS: true,
	secure: false,
	port: 587,
});

router.get("/", async (req, res, next) => {
	try {
		return res.json({ result: "Email service running" });
	} catch (err) {
		log.error(err.message);
		res.json({ message: err.message });
	}
});

router.post("/", async (req, res) => {
	log.debug("Processing");
	try {
		let message = {
			from: process.env.SENDER,
			to: req.body.email,
			subject: req.body.subject,
			text: req.body.text,
		};
		
		await transporter.sendMail(message);
		log.info(`Eail sent to ${req.body.email} from ${process.env.SENDER}`);
		res.status(200).json({ success: true, message: "Email sent successfully" });
	} catch (err) {
		log.error(err.message);
		res.status(500).json(err);
	}
});

module.exports = router;
