"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Part, PriceRule } from "@/types/database";
import { applyPriceRules } from "@/lib/price-rules";
import { conditionColors, formatPrice, formatVehicle } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { EditPartDialog } from "@/components/admin/edit-part-dialog";
import {
  ArrowLeft,
  Mail,
  Package,
  ChevronLeft,
  ChevronRight,
  Car,
  Tag,
  Layers,
  Hash,
  Calendar,
  X,
  Pencil,
  MessageCircle,
} from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";

const CONTACT_EMAIL = "hupper.motors@gmail.com";

interface PartDetailClientProps {
  initialPart: Part | null;
  priceRules?: PriceRule[];
}

export function PartDetailClient({ initialPart, priceRules = [] }: PartDetailClientProps) {
  const t = useTranslations('partDetail');
  const tCat = useTranslations('categories');
  const tCond = useTranslations('conditions');
  const tFooter = useTranslations('footer');
  const [part, setPart] = useState<Part | null>(initialPart);
  const [activePhoto, setActivePhoto] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Check if user is authenticated (admin)
  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsAdmin(!!user);
    }
    checkAuth();
  }, []);

  const photos = part?.photos || [];
  const hasPhotos = photos.length > 0;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasPhotos) return;
      if (e.key === "ArrowLeft") {
        setActivePhoto((p) => (p - 1 + photos.length) % photos.length);
      } else if (e.key === "ArrowRight") {
        setActivePhoto((p) => (p + 1) % photos.length);
      } else if (e.key === "Escape") {
        setLightboxOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasPhotos, photos.length]);

  // Touch swipe for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  }, []);
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStart === null || !hasPhotos) return;
      const diff = touchStart - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          setActivePhoto((p) => (p + 1) % photos.length);
        } else {
          setActivePhoto((p) => (p - 1 + photos.length) % photos.length);
        }
      }
      setTouchStart(null);
    },
    [touchStart, hasPhotos, photos.length]
  );

  const getMailtoLink = () => {
    if (!part) return "#";
    const pageUrl = typeof window !== "undefined" ? window.location.href : "";
    const subject = encodeURIComponent(t('emailSubject', { name: part.name }));
    const body = encodeURIComponent(
      t('emailBody', { name: part.name, url: pageUrl })
    );
    return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  };

  if (!part) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h1 className="text-2xl font-bold">{t('notFoundTitle')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('notFoundDescription')}
        </p>
        <Link href="/" className="mt-6">
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('backToCatalog')}
          </Button>
        </Link>
      </div>
    );
  }

  const vehicle = formatVehicle(part.year, part.make, part.model);

  // Structured data for Chrome Extension scraper
  const partData = {
    id: part.id,
    title: part.name,
    price: part.price,
    description: part.description || "",
    condition: part.condition,
    category: part.category,
    photos: photos,
    make: part.make || "",
    model: part.model || "",
    year: part.year || "",
    vin: part.vin || "",
    serial_number: part.serial_number || "",
    quantity: part.quantity || 1,
    price_per: part.price_per || "lot",
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hidden data for Chrome Extension scraper */}
      <div
        id="part-data"
        data-part={JSON.stringify(partData)}
        style={{ display: "none" }}
      />
      {/* Simple header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToCatalog')}
          </Link>
          <div className="flex-1" />
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-4 w-4" />
              {t('edit')}
            </Button>
          )}
          <Link href="/" className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <span className="text-sm font-bold hidden sm:inline">{t('autoParts')}</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Photo Gallery */}
          <div className="space-y-3">
            {/* Main photo */}
            <div
              className="aspect-[4/3] relative bg-muted rounded-xl overflow-hidden cursor-zoom-in"
              onClick={() => hasPhotos && setLightboxOpen(true)}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {hasPhotos ? (
                <>
                  <Image
                    src={photos[activePhoto]}
                    alt={`${part.name} photo ${activePhoto + 1}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-contain"
                    priority
                  />
                  {photos.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePhoto(
                            (activePhoto - 1 + photos.length) % photos.length
                          );
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePhoto((activePhoto + 1) % photos.length);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
                        {activePhoto + 1} / {photos.length}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Package className="h-16 w-16 text-muted-foreground/30" />
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((photo, index) => (
                  <button
                    key={index}
                    onClick={() => setActivePhoto(index)}
                    className={`relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                      index === activePhoto
                        ? "border-primary"
                        : "border-transparent hover:border-muted-foreground/30"
                    }`}
                  >
                    <Image
                      src={photo}
                      alt={`Thumbnail ${index + 1}`}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Part Details */}
          <div className="space-y-6">
            {/* Title & Price */}
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="outline" className="text-xs">
                  {(() => { try { return tCat(part.category); } catch { return part.category; } })().split(" / ")[0]}
                </Badge>
                <Badge
                  variant="secondary"
                  className={`text-xs ${conditionColors[part.condition] || ""}`}
                >
                  {(() => { try { return tCond(part.condition); } catch { return part.condition; } })()}
                </Badge>
                {(part.quantity || 1) > 1 && (
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                    {t('lotOf', { count: part.quantity })}
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{part.name}</h1>
              {(() => {
                const qty = part.quantity || 1;
                const pr = priceRules.length > 0 ? applyPriceRules(part, priceRules) : null;
                const displayPrice = pr && (pr.hasDiscount || pr.hasMarkup) ? pr.finalPrice : part.price;

                return (
                  <div className="mt-2">
                    {pr && pr.hasDiscount ? (
                      <div className="flex items-center gap-3">
                        <p className="text-3xl font-bold text-red-600">{formatPrice(pr.finalPrice)}</p>
                        <p className="text-xl text-muted-foreground line-through">{formatPrice(part.price)}</p>
                        <Badge variant="destructive" className="text-xs">
                          -{pr.appliedRule?.amount_type === "percent" ? `${pr.appliedRule.amount}%` : `$${pr.appliedRule?.amount}`}
                        </Badge>
                      </div>
                    ) : (
                      <p className="text-3xl font-bold text-primary">{formatPrice(displayPrice)}</p>
                    )}
                    {qty > 1 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('lotOf', { count: qty })}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            <Separator />

            {/* Vehicle Info */}
            {vehicle && (
              <div className="flex items-center gap-3 text-sm">
                <Car className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{vehicle}</span>
              </div>
            )}

            {part.vin && (
              <div className="flex items-center gap-3 text-sm">
                <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  {t('vin')} <span className="font-mono">{part.vin}</span>
                </span>
              </div>
            )}

            {part.stock_number && (
              <div className="flex items-center gap-3 text-sm">
                <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  {t('stockNumber')} <span className="font-mono">{part.stock_number}</span>
                </span>
              </div>
            )}

            {part.serial_number && (
              <div className="flex items-center gap-3 text-sm">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  {t('serialNumber')} <span className="font-mono">{part.serial_number}</span>
                </span>
              </div>
            )}

            <div className="flex items-center gap-3 text-sm">
              <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{(() => { try { return tCat(part.category); } catch { return part.category; } })()}</span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>
                {t('listed', { date: new Date(part.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }) })}
              </span>
            </div>

            {/* Description */}
            {part.description && (
              <>
                <Separator />
                <div>
                  <h2 className="font-semibold mb-2">{t('description')}</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {part.description}
                  </p>
                </div>
              </>
            )}

            <Separator />

            {/* Buy Button */}
            <div className="space-y-3">
              <Button
                size="lg"
                className="w-full text-base gap-2"
                onClick={() => {
                  // Open chat widget by dispatching custom event
                  window.dispatchEvent(new CustomEvent("open-chat"));
                }}
              >
                <MessageCircle className="h-5 w-5" />
                {t('chatWithUs')}
              </Button>
              <a href={getMailtoLink()}>
                <Button size="lg" variant="outline" className="w-full text-base gap-2">
                  <Mail className="h-5 w-5" />
                  {t('contactViaEmail')}
                </Button>
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-black/95">
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 z-50 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          {hasPhotos && (
            <div
              className="relative w-full h-[85vh] flex items-center justify-center"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <Image
                src={photos[activePhoto]}
                alt={`${part.name} photo ${activePhoto + 1}`}
                fill
                sizes="95vw"
                className="object-contain"
              />
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setActivePhoto(
                        (activePhoto - 1 + photos.length) % photos.length
                      )
                    }
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={() =>
                      setActivePhoto((activePhoto + 1) % photos.length)
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 text-white text-sm px-4 py-1.5 rounded-full">
                    {activePhoto + 1} / {photos.length}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Edit Dialog */}
      {isAdmin && part && (
        <EditPartDialog
          part={part}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={async () => {
            const supabase = createClient();
            const { data } = await supabase
              .from("parts")
              .select("*")
              .eq("id", part.id)
              .single();
            if (data) setPart(data);
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>
            {tFooter('copyright', { year: new Date().getFullYear() })}
            {" | "}
            <Link href="/privacy" className="underline hover:text-foreground">{tFooter('privacy')}</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
