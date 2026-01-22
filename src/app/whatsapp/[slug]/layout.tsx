import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	ArrowLeft,
	MessageSquare,
	Users,
	UsersRound,
	Settings,
	Webhook,
	Home,
	Check,
	X,
	ChevronsUpDown,
	UserPlus,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { ConnectButton } from "./connect-button";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getWAFromSlugUserIdCache } from "./cache";
import { Suspense } from "react";
import { db } from "@/db";
import { whatsappTable, whatsappMemberTable } from "@/db/schema";
import { eq, or, inArray } from "drizzle-orm";
import { ClientLayout } from "./client-layout";

function SidebarItem({
	href,
	icon,
	children,
	active = false,
}: {
	href: string;
	icon: React.ReactNode;
	children: React.ReactNode;
	active?: boolean;
}) {
	return (
		<Link
			href={href}
			className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
				active
					? "bg-accent text-accent-foreground"
					: "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
			}`}
		>
			{icon}
			{children}
		</Link>
	);
}

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
		<ClientLayout whatsappId={wa.id}>
		<div className="flex h-screen bg-background">
			{/* Sidebar */}
			<aside className="w-56 border-r flex flex-col bg-muted/30">
				{/* Sidebar Header */}
				<div className="p-3 border-b space-y-3">
					<Button variant="ghost" size="sm" asChild className="w-full justify-start h-8 px-2 text-muted-foreground">
						<Link href="/" className="gap-2">
							<ArrowLeft className="h-4 w-4" />
							<span>Back to WhatsApps</span>
						</Link>
					</Button>

					{/* WhatsApp Selector Dropdown */}
					<Popover>
						<PopoverTrigger asChild>
							<Button variant="outline" size="sm" className="w-full justify-start h-auto px-2 py-1.5">
								<div className="flex items-center gap-2 flex-1 min-w-0">
									<div
										className={`h-5 w-5 rounded flex items-center justify-center shrink-0 ${
											wa.connected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
										}`}
									>
										<MessageSquare className="h-3 w-3" strokeWidth={2} />
									</div>
									<span className="truncate text-sm">{wa.name}</span>
								</div>
								<ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-56 p-1" align="start">
							<ScrollArea className="max-h-[300px]">
								<div className="p-1">
									{allWhatsapps.map((w) => (
										<Link
											key={w.id}
											href={`/whatsapp/${w.slug}`}
											className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
												w.id === wa.id
													? "bg-accent text-accent-foreground"
													: "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
											}`}
										>
											<div
												className={`h-4 w-4 rounded flex items-center justify-center shrink-0 ${
													w.connected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
												}`}
											>
												<MessageSquare className="h-2.5 w-2.5" strokeWidth={2} />
											</div>
											<span className="truncate">{w.name}</span>
											{w.id === wa.id && (
												<Check className="h-3.5 w-3.5 shrink-0 ml-auto" />
											)}
										</Link>
									))}
								</div>
							</ScrollArea>
						</PopoverContent>
					</Popover>

					{/* Status Badges */}
					<div className="flex items-center gap-1.5">
						<Badge variant={wa.connected ? "default" : "secondary"} className="gap-1 text-[10px] px-1.5 py-0">
							{wa.connected ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
							{wa.connected ? "Online" : "Offline"}
						</Badge>
						<Badge variant={wa.enabled ? "default" : "outline"} className="text-[10px] px-1.5 py-0">
							{wa.enabled ? "Active" : "Inactive"}
						</Badge>
					</div>
				</div>

				{/* Sidebar Navigation */}
				<ScrollArea className="flex-1 px-2 py-2">
					<nav className="space-y-0.5">
						<SidebarItem href={`/whatsapp/${wa.slug}`} icon={<Home className="h-4 w-4" />}>
							Overview
						</SidebarItem>
						<SidebarItem href={`/whatsapp/${wa.slug}/chats`} icon={<MessageSquare className="h-4 w-4" />}>
							Chats
						</SidebarItem>
						<SidebarItem href={`/whatsapp/${wa.slug}/contacts`} icon={<Users className="h-4 w-4" />}>
							Contacts
						</SidebarItem>
						<SidebarItem href={`/whatsapp/${wa.slug}/groups`} icon={<UsersRound className="h-4 w-4" />}>
							Groups
						</SidebarItem>
						<Separator className="my-2" />
						<SidebarItem href={`/whatsapp/${wa.slug}/connections/create`} icon={<Webhook className="h-4 w-4" />}>
							New Connection
						</SidebarItem>
						<SidebarItem href={`/whatsapp/${wa.slug}/members`} icon={<UserPlus className="h-4 w-4" />}>
							Members
						</SidebarItem>
						<SidebarItem href={`/whatsapp/${wa.slug}/settings/cleanup`} icon={<Trash2 className="h-4 w-4" />}>
							Cleanup
						</SidebarItem>
						<SidebarItem href={`/whatsapp/${wa.slug}/edit`} icon={<Settings className="h-4 w-4" />}>
							Settings
						</SidebarItem>
					</nav>
				</ScrollArea>

				{/* Sidebar Footer */}
				<div className="p-3 border-t">
					<ConnectButton id={wa.id} isConnected={wa.connected} />
				</div>
			</aside>

			{/* Main Content Area */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{/* Top Bar with Breadcrumb */}
				<header className="h-12 border-b flex items-center px-4 shrink-0">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Link href="/" className="hover:text-foreground transition-colors">
							WhatsApps
						</Link>
						<span>/</span>
						<span className="text-foreground font-medium">{wa.name}</span>
					</div>
				</header>

				{/* Page Content */}
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4">
					{children}
				</div>
			</div>
		</div>
		</ClientLayout>
	);
}
export default function WhatsappLayoutWrapper(props: {
	children: React.ReactNode;
	params: Promise<{ slug: string }>;
}) {
	return (
		<Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>
			<WhatsappLayout {...props} />
		</Suspense>
	);
}