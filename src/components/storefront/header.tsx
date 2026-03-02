"use client";

import { useState, useRef, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslations } from "next-intl";

interface HeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
}

export function StorefrontHeader({ search, onSearchChange }: HeaderProps) {
  const t = useTranslations('header');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mobileSearchOpen && mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  }, [mobileSearchOpen]);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Mobile search overlay */}
      {mobileSearchOpen && (
        <div className="absolute inset-0 z-50 bg-background flex items-center gap-2 px-4 h-16 sm:hidden">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <Input
            ref={mobileInputRef}
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="flex-1 text-base border-0 shadow-none focus-visible:ring-0 px-0"
          />
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => {
              setMobileSearchOpen(false);
              if (!search) onSearchChange("");
            }}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}

      <div className="container mx-auto px-4 h-16 flex items-center gap-4 sm:gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src="/icon.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9"
            priority
          />
          <span className="text-lg font-bold hidden sm:inline">HuppeR Auto Parts</span>
        </Link>

        {/* Mobile: search icon button */}
        <Button
          variant="outline"
          size="icon"
          className="sm:hidden shrink-0"
          onClick={() => setMobileSearchOpen(true)}
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Desktop: inline search */}
        <div className="relative flex-1 max-w-md hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1" />

        <LanguageSwitcher />
      </div>
    </header>
  );
}
