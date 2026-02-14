"use client";

import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
}

export function StorefrontHeader({ search, onSearchChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src="/logo.png"
            alt="HuppeR Auto Parts"
            width={160}
            height={40}
            className="h-9 w-auto"
            priority
          />
        </Link>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search parts, make, model..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1" />

        <Link
          href="/admin/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Admin
        </Link>
      </div>
    </header>
  );
}
