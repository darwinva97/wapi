import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, MessageSquare, Users } from "lucide-react";
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
		<div className="min-h-screen bg-gray-50 p-8">
			<div className="mx-auto max-w-7xl space-y-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<Button variant="ghost" size="icon" asChild>
							<Link href="/">
								<ArrowLeft className="h-4 w-4" />
							</Link>
						</Button>
						<h1 className="text-3xl font-bold tracking-tight text-gray-900">
							{wa.name}
						</h1>
						<Badge variant={wa.connected ? 'default' : 'destructive'}>
							{wa.connected ? 'Conectado' : 'Desconectado'}
						</Badge>
					</div>
					<div className="flex gap-2">
						<NavLink icon={<MessageSquare className="mr-2 h-4 w-4" />} text="Chats" baseSlug={wa.slug} slug="chats" />
						<NavLink icon={<Users className="mr-2 h-4 w-4" />} text="Contactos" baseSlug={wa.slug} slug="contacts" />
						<NavLink icon={<Edit className="mr-2 h-4 w-4" />} text="Editar" baseSlug={wa.slug} slug="edit" />
						<ConnectButton id={wa.id} isConnected={wa.connected} />
					</div>
				</div>
				<main>
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