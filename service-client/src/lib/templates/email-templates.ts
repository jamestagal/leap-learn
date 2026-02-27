/**
 * Email Templates
 *
 * HTML email generators for team invitations, member notifications,
 * and beta invites. Uses inline styles for maximum email client compatibility.
 */

// =============================================================================
// Types
// =============================================================================

export interface TeamInvitationData {
	organisation: {
		name: string;
		primaryColor?: string;
		logoUrl?: string;
	};
	invitee: { email: string };
	inviter: { name: string };
	role: string;
	loginUrl: string;
}

// =============================================================================
// Shared Helpers
// =============================================================================

const DEFAULT_PRIMARY_COLOR = "#4F46E5";

function getPrimaryColor(color?: string): string {
	return color || DEFAULT_PRIMARY_COLOR;
}

function emailWrapper(primaryColor: string, content: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LeapLearn</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
<tr>
<td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
<!-- Header -->
<tr>
<td style="background-color: ${primaryColor}; padding: 24px 32px;">
<span style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">LeapLearn</span>
</td>
</tr>
<!-- Body -->
<tr>
<td style="padding: 32px;">
${content}
</td>
</tr>
<!-- Footer -->
<tr>
<td style="padding: 20px 32px; border-top: 1px solid #e4e4e7; text-align: center;">
<p style="margin: 0; font-size: 12px; color: #a1a1aa;">
This email was sent by LeapLearn. If you did not expect this email, you can safely ignore it.
</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

function buttonHtml(url: string, label: string, primaryColor: string): string {
	return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
<tr>
<td style="background-color: ${primaryColor}; border-radius: 6px; padding: 12px 24px;">
<a href="${url}" target="_blank" style="color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">${label}</a>
</td>
</tr>
</table>`;
}

// =============================================================================
// Team Invitation Email (new user, no account yet)
// =============================================================================

export function generateTeamInvitationEmail(data: TeamInvitationData): {
	subject: string;
	bodyHtml: string;
} {
	const primaryColor = getPrimaryColor(data.organisation.primaryColor);

	const content = `
<h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #18181b;">
You've been invited to join ${data.organisation.name}
</h1>
<p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
${data.inviter.name} has invited you to join <strong>${data.organisation.name}</strong> on LeapLearn as a <strong>${data.role}</strong>.
</p>
<p style="margin: 0 0 4px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
Click the button below to create your account and get started.
</p>
${buttonHtml(data.loginUrl, "Accept Invitation", primaryColor)}
<p style="margin: 0; font-size: 13px; color: #71717a;">
Or copy and paste this link into your browser:<br>
<a href="${data.loginUrl}" style="color: ${primaryColor}; word-break: break-all;">${data.loginUrl}</a>
</p>`;

	return {
		subject: `You've been invited to join ${data.organisation.name} on LeapLearn`,
		bodyHtml: emailWrapper(primaryColor, content),
	};
}

// =============================================================================
// Team Added Email (existing user, already has an account)
// =============================================================================

export function generateTeamAddedEmail(data: TeamInvitationData): {
	subject: string;
	bodyHtml: string;
} {
	const primaryColor = getPrimaryColor(data.organisation.primaryColor);

	const content = `
<h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #18181b;">
You've been added to ${data.organisation.name}
</h1>
<p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
${data.inviter.name} has added you to <strong>${data.organisation.name}</strong> on LeapLearn as a <strong>${data.role}</strong>.
</p>
<p style="margin: 0 0 4px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
You can switch to this organisation from your dashboard.
</p>
${buttonHtml(data.loginUrl, `Go to ${data.organisation.name}`, primaryColor)}
<p style="margin: 0; font-size: 13px; color: #71717a;">
Or copy and paste this link into your browser:<br>
<a href="${data.loginUrl}" style="color: ${primaryColor}; word-break: break-all;">${data.loginUrl}</a>
</p>`;

	return {
		subject: `You've been added to ${data.organisation.name} on LeapLearn`,
		bodyHtml: emailWrapper(primaryColor, content),
	};
}

// =============================================================================
// Beta Invite Email
// =============================================================================

export function generateBetaInviteEmail(data: {
	inviteUrl: string;
	expiresAt: Date;
}): { subject: string; bodyHtml: string } {
	const primaryColor = DEFAULT_PRIMARY_COLOR;

	const expiresFormatted = new Intl.DateTimeFormat("en-AU", {
		dateStyle: "long",
	}).format(new Date(data.expiresAt));

	const content = `
<h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #18181b;">
You're invited to the LeapLearn Beta
</h1>
<p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
You've been selected as an early tester for LeapLearn. As a beta user, you'll get free access to create your organisation and explore the platform.
</p>
<p style="margin: 0 0 4px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
Click the button below to accept your invitation and set up your account.
</p>
${buttonHtml(data.inviteUrl, "Accept Beta Invite", primaryColor)}
<p style="margin: 0 0 12px; font-size: 13px; color: #71717a;">
Or copy and paste this link into your browser:<br>
<a href="${data.inviteUrl}" style="color: ${primaryColor}; word-break: break-all;">${data.inviteUrl}</a>
</p>
<p style="margin: 0; font-size: 13px; color: #71717a;">
This invitation expires on <strong>${expiresFormatted}</strong>.
</p>`;

	return {
		subject: "You're invited to the LeapLearn Beta",
		bodyHtml: emailWrapper(primaryColor, content),
	};
}
