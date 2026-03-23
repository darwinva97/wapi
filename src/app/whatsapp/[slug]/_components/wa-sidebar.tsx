"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
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
	PanelLeftClose,
	PanelLeftOpen,
} from "lucide-react";
import { ConnectButton } from "../connect-button";

interface WaSidebarProps {
	wa: {
		id: string;
		name: string;
		slug: string;
		connected: boolean;
		enabled: boolean;
	};
	allWhatsapps: {
		id: string;
		name: string;
		slug: string;
		connected: boolean;
	}[];
}

function SidebarItem({
	href,
	icon,
	children,
	collapsed,
}: {
	href: string;
	icon: React.ReactNode;
	children: React.ReactNode;
	collapsed?: boolean;
}) {
	const pathname = usePathname();
	const isActive = pathname === href;

	return (
		<Link
			href={href}
			title={collapsed ? String(children) : undefined}
			className={`flex items-center gap-2.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
				collapsed ? "justify-center px-2" : ""
			} ${
				isActive
					? "bg-sidebar-accent text-sidebar-accent-foreground"
					: "text-sidebar-foreground hover:bg-sidebar-accent/50"
			}`}
		>
			{icon}
			{!collapsed && children}
		</Link>
	);
}

export function WaSidebar({ wa, allWhatsapps }: WaSidebarProps) {
	const [collapsed, setCollapsed] = useState(false);

	return (
		<aside
			className={`${
				collapsed ? "w-[60px]" : "w-[260px]"
			} border-r border-sidebar-border flex flex-col bg-sidebar transition-all duration-200`}
		>
			{/* Header Section */}
			<div className="border-b border-sidebar-border p-3 space-y-3">
				{/* Logo + Collapse Button */}
				<div className="flex items-center justify-between">
					<div className={`flex items-center gap-2 ${collapsed ? "justify-center w-full" : ""}`}>
						<div className="h-7 w-7 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
							<span className="text-white text-xs font-bold">W</span>
						</div>
						{!collapsed && (
							<span className="font-mono font-bold text-sidebar-accent-foreground text-sm">
								WAPI
							</span>
						)}
					</div>
					{!collapsed && (
						<button
							onClick={() => setCollapsed(true)}
							className="text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors p-1 rounded-md hover:bg-sidebar-accent/50"
							title="Colapsar sidebar"
						>
							<PanelLeftClose className="h-4 w-4" />
						</button>
					)}
				</div>

				{/* WhatsApp Selector - hidden when collapsed */}
				{!collapsed && (
					<>
						<Popover>
							<PopoverTrigger asChild>
								<button className="w-full flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent/50">
									<div
										className={`h-4 w-4 rounded-full shrink-0 ${
											wa.connected ? "bg-orange-500" : "bg-muted-foreground/30"
										}`}
									/>
									<span className="truncate flex-1 text-left text-sidebar-accent-foreground">
										{wa.name}
									</span>
									<ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-foreground shrink-0" />
								</button>
							</PopoverTrigger>
							<PopoverContent className="w-[228px] p-1" align="start">
								<ScrollArea className="max-h-[300px]">
									<div className="p-1">
										{allWhatsapps.map((w) => (
											<Link
												key={w.id}
												href={`/whatsapp/${w.slug}`}
												className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
													w.id === wa.id
														? "bg-accent text-accent-foreground"
														: "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
												}`}
											>
												<div
													className={`h-4 w-4 rounded-full shrink-0 ${
														w.connected ? "bg-orange-500" : "bg-muted-foreground/30"
													}`}
												/>
												<span className="truncate flex-1">{w.name}</span>
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
							<Badge
								variant={wa.connected ? "default" : "secondary"}
								className="gap-1 text-[10px] px-2 py-0.5 rounded-full"
							>
								{wa.connected ? (
									<Check className="h-2.5 w-2.5" />
								) : (
									<X className="h-2.5 w-2.5" />
								)}
								{wa.connected ? "Online" : "Offline"}
							</Badge>
							<Badge
								variant={wa.enabled ? "default" : "outline"}
								className="text-[10px] px-2 py-0.5 rounded-full"
							>
								{wa.enabled ? "Active" : "Inactive"}
							</Badge>
						</div>
					</>
				)}
			</div>

			{/* Collapsed: expand button */}
			{collapsed && (
				<div className="flex justify-center py-2">
					<button
						onClick={() => setCollapsed(false)}
						className="text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors p-1.5 rounded-md hover:bg-sidebar-accent/50"
						title="Expandir sidebar"
					>
						<PanelLeftOpen className="h-4 w-4" />
					</button>
				</div>
			)}

			{/* Navigation */}
			<div className="flex-1 px-2 py-2 overflow-y-auto">
				{!collapsed && (
					<p className="text-xs font-mono text-sidebar-foreground uppercase tracking-wider px-3 py-2">
						General
					</p>
				)}
				<nav className="space-y-0.5">
					<SidebarItem
						href={`/whatsapp/${wa.slug}`}
						icon={<Home className="h-4 w-4" />}
						collapsed={collapsed}
					>
						Overview
					</SidebarItem>
					<SidebarItem
						href={`/whatsapp/${wa.slug}/chats`}
						icon={<MessageSquare className="h-4 w-4" />}
						collapsed={collapsed}
					>
						Chats
					</SidebarItem>
					<SidebarItem
						href={`/whatsapp/${wa.slug}/contacts`}
						icon={<Users className="h-4 w-4" />}
						collapsed={collapsed}
					>
						Contacts
					</SidebarItem>
					<SidebarItem
						href={`/whatsapp/${wa.slug}/groups`}
						icon={<UsersRound className="h-4 w-4" />}
						collapsed={collapsed}
					>
						Groups
					</SidebarItem>
				</nav>

				<Separator className="my-2 bg-sidebar-border" />

				{!collapsed && (
					<p className="text-xs font-mono text-sidebar-foreground uppercase tracking-wider px-3 py-2">
						Settings
					</p>
				)}
				<nav className="space-y-0.5">
					<SidebarItem
						href={`/whatsapp/${wa.slug}/connections/create`}
						icon={<Webhook className="h-4 w-4" />}
						collapsed={collapsed}
					>
						New Connection
					</SidebarItem>
					<SidebarItem
						href={`/whatsapp/${wa.slug}/members`}
						icon={<UserPlus className="h-4 w-4" />}
						collapsed={collapsed}
					>
						Members
					</SidebarItem>
					<SidebarItem
						href={`/whatsapp/${wa.slug}/settings/cleanup`}
						icon={<Trash2 className="h-4 w-4" />}
						collapsed={collapsed}
					>
						Cleanup
					</SidebarItem>
					<SidebarItem
						href={`/whatsapp/${wa.slug}/edit`}
						icon={<Settings className="h-4 w-4" />}
						collapsed={collapsed}
					>
						Settings
					</SidebarItem>
				</nav>
			</div>

			{/* Footer */}
			<div className="border-t border-sidebar-border p-3">
				{collapsed ? (
					<div className="flex justify-center">
						<div
							className={`h-3 w-3 rounded-full ${
								wa.connected ? "bg-green-500" : "bg-muted-foreground/30"
							}`}
							title={wa.connected ? "Conectado" : "Desconectado"}
						/>
					</div>
				) : (
					<ConnectButton id={wa.id} isConnected={wa.connected} />
				)}
			</div>
		</aside>
	);
}
