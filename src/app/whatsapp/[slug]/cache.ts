import { db } from "@/db";
import { whatsappTable, whatsappMemberTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { cache } from "react";

const getWAFromSlugUserId = async ({
	slug,
	userId,
	isAdmin = false,
}: {
	slug: string;
	userId: string;
	isAdmin?: boolean;
}) => {
	// Get the WhatsApp instance by slug
	const wa = await db.query.whatsappTable.findFirst({
		where: eq(whatsappTable.slug, slug),
	});

	if (!wa) {
		return null;
	}

	// Platform admins have full access
	if (isAdmin) {
		return wa;
	}

	// Check if user is a member of this instance
	const member = await db.query.whatsappMemberTable.findFirst({
		where: and(
			eq(whatsappMemberTable.whatsappId, wa.id),
			eq(whatsappMemberTable.userId, userId)
		),
	});

	// Also allow access if user is the original owner (userId field) for backwards compatibility
	if (!member && wa.userId !== userId) {
		return null;
	}

	return wa;
};

export const getWAFromSlugUserIdCache = cache(getWAFromSlugUserId);