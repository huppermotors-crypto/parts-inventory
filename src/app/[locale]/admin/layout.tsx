"use client";

import { useState, useEffect, useCallback } from "react";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  PlusCircle,
  BarChart3,
  Search,
  LogOut,
  ExternalLink,
  Menu,
  Download,
  Percent,
  DollarSign,
  ShoppingBag,
  MessageCircle,
  Globe2,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { key: "dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { key: "addPart", href: "/admin/add", icon: PlusCircle },
  { key: "lookup", href: "/admin/lookup", icon: Search },
  { key: "analytics", href: "/admin/analytics", icon: BarChart3 },
  { key: "pricing", href: "/admin/pricing", icon: Percent },
  { key: "listings", href: "/admin/listings", icon: ShoppingBag },
  { key: "stats", href: "/admin/stats", icon: DollarSign },
  { key: "chats", href: "/admin/chats", icon: MessageCircle },
  { key: "seo", href: "/admin/seo", icon: Globe2 },
  { key: "settings", href: "/admin/settings", icon: Settings },
];

const supabase = createClient();

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations('admin.nav');
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/chats/unread");
      if (res.ok) {
        const { count } = await res.json();
        setUnreadChats(count || 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const sidebarContent = (
    <>
      <div className="p-4">
        <Link
          href="/admin/dashboard"
          className="flex items-center gap-2"
          onClick={() => setSidebarOpen(false)}
        >
          <Image
            src="/icon.png"
            alt=""
            width={40}
            height={40}
            className="h-9 w-9"
            priority
          />
          <span className="text-base font-bold leading-tight">HuppeR<br/>Auto Parts</span>
        </Link>
      </div>
      <Separator />
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors min-h-[44px]",
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {t(item.key)}
            {item.href === "/admin/chats" && unreadChats > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                {unreadChats > 99 ? "99+" : unreadChats}
              </span>
            )}
          </Link>
        ))}
      </nav>
      <Separator />
      <div className="p-4 space-y-2">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors min-h-[44px]"
        >
          <ExternalLink className="h-4 w-4" />
          {t('viewStorefront')}
        </Link>
        <a
          href="/extension.zip"
          download="AutoParts-Extension-v1.1.2.zip"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors min-h-[44px]"
        >
          <Download className="h-4 w-4" />
          {t('chromeExtension')}
        </a>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground min-h-[44px]"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          {t('logout')}
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 h-14 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => setSidebarOpen(true)}
          aria-label={t('openMenu')}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <Image
            src="/icon.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8"
          />
          <span className="font-bold text-sm">HuppeR Auto Parts</span>
        </Link>
      </header>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0 overflow-y-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>{t('navigation')}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-full">{sidebarContent}</div>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r bg-muted/40 flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
