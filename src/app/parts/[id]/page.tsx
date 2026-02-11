"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Part } from "@/types/database";
import { getCategoryLabel, getConditionLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Mail,
  Package,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Car,
  Tag,
  Layers,
  Hash,
  Calendar,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const CONTACT_EMAIL = "my-email@example.com";

const conditionColors: Record<string, string> = {
  new: "bg-green-100 text-green-800",
  like_new: "bg-emerald-100 text-emerald-800",
  excellent: "bg-blue-100 text-blue-800",
  good: "bg-sky-100 text-sky-800",
  fair: "bg-yellow-100 text-yellow-800",
  used: "bg-orange-100 text-orange-800",
  for_parts: "bg-red-100 text-red-800",
};

const supabase = createClient();

export default function PartDetailPage() {
  const params = useParams();
  const [part, setPart] = useState<Part | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);

  const fetchPart = useCallback(async () => {
    if (!params.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("parts")
      .select("*")
      .eq("id", params.id)
      .eq("is_published", true)
      .single();

    if (error || !data) {
      console.error("Error fetching part:", error);
      setPart(null);
    } else {
      setPart(data);
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    fetchPart();
  }, [fetchPart]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);

  const getMailtoLink = () => {
    if (!part) return "#";
    const pageUrl = typeof window !== "undefined" ? window.location.href : "";
    const subject = encodeURIComponent(`Interest in: ${part.name}`);
    const body = encodeURIComponent(
      `Hi, I'm interested in buying this part: ${part.name}\n\nLink: ${pageUrl}`
    );
    return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!part) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h1 className="text-2xl font-bold">Part Not Found</h1>
        <p className="text-muted-foreground mt-2">
          This part may have been removed or is no longer available.
        </p>
        <Link href="/" className="mt-6">
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Catalog
          </Button>
        </Link>
      </div>
    );
  }

  const vehicle = [part.year, part.make, part.model].filter(Boolean).join(" ");
  const photos = part.photos || [];
  const hasPhotos = photos.length > 0;

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
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hidden data for Chrome Extension scraper */}
      <script
        id="part-data"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(partData) }}
      />
      {/* Simple header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Catalog
          </Link>
          <div className="flex-1" />
          <Link href="/" className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <span className="text-sm font-bold hidden sm:inline">Auto Parts</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Photo Gallery */}
          <div className="space-y-3">
            {/* Main photo */}
            <div className="aspect-[4/3] relative bg-muted rounded-xl overflow-hidden">
              {hasPhotos ? (
                <>
                  <Image
                    src={photos[activePhoto]}
                    alt={`${part.name} photo ${activePhoto + 1}`}
                    fill
                    className="object-contain"
                    priority
                  />
                  {photos.length > 1 && (
                    <>
                      <button
                        onClick={() =>
                          setActivePhoto(
                            (activePhoto - 1 + photos.length) % photos.length
                          )
                        }
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() =>
                          setActivePhoto((activePhoto + 1) % photos.length)
                        }
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
                  {getCategoryLabel(part.category).split(" / ")[0]}
                </Badge>
                <Badge
                  variant="secondary"
                  className={`text-xs ${conditionColors[part.condition] || ""}`}
                >
                  {getConditionLabel(part.condition)}
                </Badge>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{part.name}</h1>
              <p className="text-3xl font-bold text-primary mt-2">
                {formatPrice(part.price)}
              </p>
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
                  VIN: <span className="font-mono">{part.vin}</span>
                </span>
              </div>
            )}

            {part.serial_number && (
              <div className="flex items-center gap-3 text-sm">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  S/N: <span className="font-mono">{part.serial_number}</span>
                </span>
              </div>
            )}

            <div className="flex items-center gap-3 text-sm">
              <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{getCategoryLabel(part.category)}</span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>
                Listed{" "}
                {new Date(part.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>

            {/* Description */}
            {part.description && (
              <>
                <Separator />
                <div>
                  <h2 className="font-semibold mb-2">Description</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {part.description}
                  </p>
                </div>
              </>
            )}

            <Separator />

            {/* Buy Button */}
            <div className="space-y-3">
              <a href={getMailtoLink()}>
                <Button size="lg" className="w-full text-base gap-2">
                  <Mail className="h-5 w-5" />
                  I&apos;m Interested — Contact Seller
                </Button>
              </a>
              <p className="text-xs text-muted-foreground text-center">
                Clicking the button will open your email client with a
                pre-filled message.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} Auto Parts Inventory. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
