import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: Number(process.env.SMTP_PORT || 587),
	secure: process.env.SMTP_SECURE === 'true',
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS,
	},
});

export async function SendMail(html: string, subject: string, to: string) {
	try {
		const info = await transporter.sendMail({
			from: `"MEMEMMEMEME" <${process.env.SMTP_FROM}>`, // sender address
			to: to, // list of recipients
			subject: subject, // subject line
			html: html, // HTML body
		});

		console.log("Message sent: %s", info.messageId);
	} catch (err) {
		console.error("Error while sending mail", err);
	}
}
