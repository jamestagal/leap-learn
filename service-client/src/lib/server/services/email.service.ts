/**
 * Email Service
 *
 * Handles sending emails via Resend API (production) or SMTP (local development).
 * Supports attachments for PDF documents.
 */

import { Resend } from "resend";
import nodemailer from "nodemailer";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env file explicitly for Docker compatibility
// Vite doesn't always expose env vars to process.env in dev mode
config({ path: resolve(process.cwd(), ".env") });
const env = process.env;

// Initialize Resend client lazily
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
	const apiKey = env["RESEND_API_KEY"];
	if (!apiKey) {
		return null;
	}
	if (!resendClient) {
		resendClient = new Resend(apiKey);
	}
	return resendClient;
}

// Initialize SMTP transporter lazily
let smtpTransporter: nodemailer.Transporter | null = null;

function getSmtpTransporter(): nodemailer.Transporter | null {
	const host = env["SMTP_HOST"];
	const port = env["SMTP_PORT"];
	if (!host) {
		return null;
	}
	if (!smtpTransporter) {
		smtpTransporter = nodemailer.createTransport({
			host,
			port: parseInt(port || "1025", 10),
			secure: false, // Mailpit doesn't use TLS
			auth: undefined, // Mailpit doesn't require auth
		});
	}
	return smtpTransporter;
}

// =============================================================================
// Types
// =============================================================================

export interface EmailAttachment {
	filename: string;
	content: Buffer;
}

export interface SendEmailOptions {
	to: string;
	subject: string;
	html: string;
	replyTo?: string;
	attachments?: EmailAttachment[];
}

export interface SendEmailResult {
	success: boolean;
	messageId?: string;
	error?: string;
}

// =============================================================================
// Email Sending
// =============================================================================

/**
 * Send an email via Resend (production) or SMTP (local development)
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
	const { to, subject, html, replyTo, attachments } = options;

	// Default from address - use environment variable or fallback
	const fromAddress = env["EMAIL_FROM_ADDRESS"] || "noreply@leaplearn.au";
	const fromName = env["EMAIL_FROM_NAME"] || "LeapLearn";
	const from = `${fromName} <${fromAddress}>`;

	// Build options object, only including optional fields if defined
	const emailOpts = {
		to,
		subject,
		html,
		from,
		...(replyTo && { replyTo }),
		...(attachments && { attachments }),
	};

	// Try Resend first (production)
	const resend = getResendClient();
	if (resend) {
		return sendViaResend(resend, emailOpts);
	}

	// Fall back to SMTP (local development with Mailpit)
	const smtp = getSmtpTransporter();
	if (smtp) {
		return sendViaSmtp(smtp, emailOpts);
	}

	console.error("No email service configured (RESEND_API_KEY or SMTP_HOST required)");
	return {
		success: false,
		error: "Email service not configured",
	};
}

/**
 * Send email via Resend API
 */
async function sendViaResend(
	resend: Resend,
	options: SendEmailOptions & { from: string },
): Promise<SendEmailResult> {
	const { to, subject, html, replyTo, attachments, from } = options;

	try {
		const emailOptions: Parameters<typeof resend.emails.send>[0] = {
			from,
			to: [to],
			subject,
			html,
		};

		if (replyTo) {
			emailOptions.replyTo = replyTo;
		}

		if (attachments && attachments.length > 0) {
			emailOptions.attachments = attachments.map((att) => ({
				filename: att.filename,
				content: att.content,
			}));
		}

		const { data, error } = await resend.emails.send(emailOptions);

		if (error) {
			console.error("Resend API error:", error);
			return {
				success: false,
				error: error.message,
			};
		}

		console.log("Email sent via Resend:", data?.id);
		return {
			success: true,
			messageId: data?.id,
		};
	} catch (err) {
		console.error("Failed to send email via Resend:", err);
		return {
			success: false,
			error: err instanceof Error ? err.message : "Unknown error sending email",
		};
	}
}

/**
 * Send email via SMTP (for local development with Mailpit)
 */
async function sendViaSmtp(
	transporter: nodemailer.Transporter,
	options: SendEmailOptions & { from: string },
): Promise<SendEmailResult> {
	const { to, subject, html, replyTo, attachments, from } = options;

	try {
		const mailOptions: nodemailer.SendMailOptions = {
			from,
			to,
			subject,
			html,
		};

		if (replyTo) {
			mailOptions.replyTo = replyTo;
		}

		if (attachments && attachments.length > 0) {
			mailOptions.attachments = attachments.map((att) => ({
				filename: att.filename,
				content: att.content,
			}));
		}

		const info = await transporter.sendMail(mailOptions);

		console.log("Email sent via SMTP:", info.messageId);
		return {
			success: true,
			messageId: info.messageId,
		};
	} catch (err) {
		console.error("Failed to send email via SMTP:", err);
		return {
			success: false,
			error: err instanceof Error ? err.message : "Unknown error sending email",
		};
	}
}

/**
 * Check if email service is configured
 */
export function isEmailServiceConfigured(): boolean {
	return Boolean(env["RESEND_API_KEY"]) || Boolean(env["SMTP_HOST"]);
}
