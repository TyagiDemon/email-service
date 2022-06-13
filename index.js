const axios = require("axios");
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const jackrabbit = require("jackrabbit");

const app = express();
app.use(cors());

const dotenv = require("dotenv");
dotenv.config();

app.use(express.json({ limit: "30mb", extended: true }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));

const config = require("./config")[process.env.NODE_ENV || "development"];

const log = config.log();

const server = app.listen(process.env.PORT || 4000);

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

server.on("listening", () => {
	log.info(`Hi there! I'm listening on port ${server.address().port}`);

	const registerService = () =>
		axios
			.put(
				`https://student-portal-serviceregistry.herokuapp.com/register/${
					config.name
				}/${config.version}/${server.address().port}`
			)
			.then((res) => log.debug(res.data));
	const unregisterService = () =>
		axios.delete(
			`https://student-portal-serviceregistry.herokuapp.com/register/${
				config.name
			}/${config.version}/${server.address().port}`
		);

	registerService();

	const interval = setInterval(registerService, 240000);
	const cleanup = async () => {
		clearInterval(interval);
		await unregisterService();
	};

	const rabbit = jackrabbit(process.env.QUEUE_URL);
	const exchange = rabbit.default();

	const queue = exchange.queue({ name: "mail_queue", durable: true });
	queue.consume(onMessage);

	async function onMessage(data, ack) {
		try {
			let message = {
				from: process.env.SENDER,
				to: data.email,
				subject: data.subject,
				text: data.text,
			};

			await transporter.sendMail(message);
			log.info(`Email sent to ${data.email} from ${process.env.SENDER}`);

			ack();
		} catch (err) {
			log.error(err.message);
		}
	}

	process.on("SIGINT", async () => {
		await cleanup();
		process.exit(0);
	});

	process.on("SIGTERM", async () => {
		await cleanup();
		process.exit(0);
	});

	process
		.on("unhandledRejection", async () => {
			await cleanup();
			process.exit(0);
		})
		.on("uncaughtException", async () => {
			await cleanup();
			process.exit(0);
		});
});
