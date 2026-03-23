import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getWAFromSlugUserIdCache } from "./cache";
import { Suspense } from "react";
import { db } from "@/db";
import { whatsappTable, whatsappMemberTable } from "@/db/schema";
import { eq, or, inArray } from "drizzle-orm";
import { WaSidebar } from "./_components/wa-sidebar";

async function WhatsappLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		redirect("/login");
	}

	const wa = await getWAFromSlugUserIdCache({
		slug,
		userId: session.user.id,
		isAdmin: session.user.role === "admin",
	});

	if (!wa) {
		notFound();
	}

	// Fetch all WhatsApps the user has access to (owned or member)
	const memberInstances = await db.query.whatsappMemberTable.findMany({
		where: eq(whatsappMemberTable.userId, session.user.id),
	});
	const memberWhatsappIds = memberInstances.map((m) => m.whatsappId);

	const allWhatsapps =
		memberWhatsappIds.length > 0
			? await db.query.whatsappTable.findMany({
					where: or(
						eq(whatsappTable.userId, session.user.id),
						inArray(whatsappTable.id, memberWhatsappIds)
					),
				})
			: await db.query.whatsappTable.findMany({
					where: eq(whatsappTable.userId, session.user.id),
				});

	return (
		<div className="flex h-screen bg-background">
			<WaSidebar
				wa={{
					id: wa.id,
					name: wa.name,
					slug: wa.slug,
					connected: wa.connected,
					enabled: wa.enabled,
				}}
				allWhatsapps={allWhatsapps.map((w) => ({
					id: w.id,
					name: w.name,
					slug: w.slug,
					connected: w.connected,
				}))}
			/>

			{/* Main Area */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{/* Top Breadcrumb Bar */}
				<header className="h-12 border-b flex items-center px-6 shrink-0">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Link
							href="/"
							className="hover:text-foreground transition-colors"
						>
							WhatsApps
						</Link>
						<span>/</span>
						<span className="text-foreground font-medium">{wa.name}</span>
					</div>
				</header>

				{/* Content Area */}
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4">
					{children}
				</div>
			</div>
		</div>
	);
}

export default function WhatsappLayoutWrapper(props: {
	children: React.ReactNode;
	params: Promise<{ slug: string }>;
}) {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex items-center justify-center">
					Cargando...
				</div>
			}
		>
			<WhatsappLayout {...props} />
		</Suspense>
	);
}
