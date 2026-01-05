import { db } from "@/db";
import { whatsappTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { cache } from "react";

const getWAFromSlugUserId = async ({slug, userId}: {slug: string, userId: string}) => {
	const wa = await db.query.whatsappTable.findFirst({
		where: and(
			eq(whatsappTable.slug, slug),
			eq(whatsappTable.userId, userId)
		),
	});
	return wa;
};

export const getWAFromSlugUserIdCache = cache(getWAFromSlugUserId);