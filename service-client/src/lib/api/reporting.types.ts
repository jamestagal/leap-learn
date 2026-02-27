export type ActivityItem = {
	id: string;
	createdAt: string;
	action: string;
	entityType: string;
	entityId: string | null;
	userId: string | null;
	userName: string | null;
	newValues: Record<string, unknown> | null;
};

export type DashboardStats = {
	clientCount: number;
	formSubmissionsThisMonth: number;
	teamMemberCount: number;
};
