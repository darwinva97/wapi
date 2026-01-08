import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, MessageSquare, Users, UsersRound } from "lucide-react";
import Link from "next/link";
import { ConnectButton } from "./connect-button";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getWAFromSlugUserIdCache } from "./cache";
import { NavLink } from "./_components/nav-link";
import { Suspense } from "react";

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

	const wa = await getWAFromSlugUserIdCache({ slug, userId: session.user.id });

	if (!wa) {
		notFound();
	}
	return (
		<div className="h-screen bg-background flex flex-col overflow-hidden">
			<div className="mx-auto max-w-7xl w-full flex-1 flex flex-col min-h-0 p-8 pb-4 gap-4">
				<div className="flex items-center justify-between shrink-0">
					<div className="flex items-center gap-4">
						<Button variant="ghost" size="icon" asChild>
							<Link href="/">
								<ArrowLeft className="h-4 w-4" />
							</Link>
						</Button>
						<h1 className="text-3xl font-bold tracking-tight">
							<Link href={`/whatsapp/${wa.slug}`}>
								{wa.name}
							</Link>
						</h1>
						<Badge variant={wa.connected ? 'default' : 'destructive'}>
							{wa.connected ? 'Conectado' : 'Desconectado'}
						</Badge>
					</div>
					<div className="flex gap-2">
						<NavLink icon={<MessageSquare className="mr-2 h-4 w-4" />} text="Chats" baseSlug={wa.slug} slug="chats" />
						<NavLink icon={<Users className="mr-2 h-4 w-4" />} text="Contactos" baseSlug={wa.slug} slug="contacts" />
						<NavLink icon={<UsersRound className="mr-2 h-4 w-4" />} text="Grupos" baseSlug={wa.slug} slug="groups" />
						<NavLink icon={<Edit className="mr-2 h-4 w-4" />} text="Editar" baseSlug={wa.slug} slug="edit" />
						<ConnectButton id={wa.id} isConnected={wa.connected} />
					</div>
				</div>
				<main className="flex-1 min-h-0 overflow-hidden flex flex-col">
					{children}
				</main>
			</div>
		</div>
	);
}
export default function WhatsappLayoutWrapper(props: {
	children: React.ReactNode;
	params: Promise<{ slug: string }>;
}) {
	return <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>
		<WhatsappLayout {...props} />
	</Suspense>
}