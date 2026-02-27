export type Empty = Record<string, never>;

export type DeepNonNullable<T> = {
	[K in keyof T]: NonNullable<T[K]>;
};

export type CountResponse = {
	count: number;
};

export type UrlResponse = {
	url: string;
};

export type User = {
	id: string;
	email: string;
	phone: string;
	access: number;
	avatar: string;
	subscription_active: boolean;
};

export type Session = {
	id: string;
	phone: string;
};

export type Toast = {
	id: symbol;
	type: "success" | "error" | "warning" | "info";
	title: string;
	description: string;
	duration: number;
	action?: { label: string; onClick: () => void };
};

export type Note = {
	id: string;
	created: string;
	updated: string;
	user_id: string;
	title: string;
	category: string;
	content: string;
};

export type NoteResponse = {
	note: Note;
	user: User;
};

export type NotesResponse = {
	count: number;
	notes: NoteResponse[];
};

type Attachment = {
	id: string;
	file_name: string;
	content_type: string;
};

export type Email = {
	id: string;
	created: string;
	updated: string;
	user_id: string;
	email_to: string;
	email_from: string;
	email_subject: string;
	email_body: string;
};

export type EmailResponse = {
	email: Email;
	attachments: Attachment[];
};

export type File = {
	id: string;
	created: string;
	updated: string;
	user_id: string;
	file_name: string;
	file_size: string;
	content_type: string;
	data: string;
};
