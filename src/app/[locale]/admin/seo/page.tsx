"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  FileText,
  ImageIcon,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Globe,
  Code2,
  Link2,
  Tag,
  Wand2,
  Package,
} from "lucide-react";
import Image from "next/image";

const supabase = createClient();
const BASE_URL = "https://parts-inventory.onrender.com";

type PartSEO = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  condition: string;
  year: number | null;
  make: string | null;
  model: string | null;
  photos: string[] | null;
  stock_number: string | null;
};

function getGeneratedTitle(p: PartSEO): string {
  const vehicle = [p.year, p.make, p.model].filter(Boolean).join(" ");
  return `${p.name}${vehicle ? ` - ${vehicle}` : ""}`;
}

function getGeneratedDescription(p: PartSEO): string {
  if (p.description) return p.description.slice(0, 160);
  const vehicle = [p.year, p.make, p.model].filter(Boolean).join(" ");
  return `${p.name} for sale.${vehicle ? ` Fits ${vehicle}.` : ""} Condition: ${p.condition}. $${p.price}.`;
}

export default function SEOPage() {
  const t = useTranslations("admin.seo");
  const { toast } = useToast();
  const [parts, setParts] = useState<PartSEO[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);

  const fetchParts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("parts")
      .select("id, name, description, price, condition, year, make, model, photos, stock_number")
      .eq("is_published", true)
      .eq("is_sold", false)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to load parts", variant: "destructive" });
    }
    setParts(data || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  // SEO analysis
  const analysis = useMemo(() => {
    const withPhoto = parts.filter((p) => p.photos && p.photos.length > 0);
    const withDesc = parts.filter((p) => p.description && p.description.trim().length > 0);
    const longTitle = parts.filter((p) => getGeneratedTitle(p).length > 60);
    const missingDesc = parts.filter((p) => !p.description || p.description.trim().length === 0);
    const missingPhoto = parts.filter((p) => !p.photos || p.photos.length === 0);

    return {
      total: parts.length,
      withPhoto: withPhoto.length,
      withDesc: withDesc.length,
      missingDesc,
      missingPhoto,
      longTitle,
    };
  }, [parts]);

  const previewPart = useMemo(() => {
    if (!previewId) return null;
    return parts.find((p) => p.id === previewId) || null;
  }, [parts, previewId]);

  const handleGenerateDescriptions = async () => {
    setGenerating(true);
    let count = 0;
    for (const part of analysis.missingDesc) {
      const vehicle = [part.year, part.make, part.model].filter(Boolean).join(" ");
      const desc = `${part.name} for sale.${vehicle ? ` Fits ${vehicle}.` : ""} Condition: ${part.condition}. $${part.price}.`;
      const { error } = await supabase
        .from("parts")
        .update({ description: desc })
        .eq("id", part.id);
      if (!error) count++;
    }
    toast({ title: t("generated", { count }) });
    setGenerating(false);
    fetchParts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
          <TabsTrigger value="preview">{t("preview")}</TabsTrigger>
          <TabsTrigger value="issues">{t("issues")}</TabsTrigger>
          <TabsTrigger value="technical">{t("technical")}</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-4">
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Package className="h-4 w-4" />
                  <span className="text-sm">{t("totalParts")}</span>
                </div>
                <p className="text-2xl font-bold">{analysis.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <ImageIcon className="h-4 w-4" />
                  <span className="text-sm">{t("withPhoto")}</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{analysis.withPhoto}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">{t("missingDesc")}</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{analysis.missingDesc.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <ImageIcon className="h-4 w-4" />
                  <span className="text-sm">{t("missingPhoto")}</span>
                </div>
                <p className="text-2xl font-bold text-amber-600">{analysis.missingPhoto.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* SEO score */}
          {analysis.total > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t("score")}</span>
                  <span className="text-2xl font-bold">
                    {Math.round(
                      ((analysis.withDesc + analysis.withPhoto + (analysis.total - analysis.longTitle.length)) /
                        (analysis.total * 3)) *
                        100
                    )}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{
                      width: `${Math.round(
                        ((analysis.withDesc + analysis.withPhoto + (analysis.total - analysis.longTitle.length)) /
                          (analysis.total * 3)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Parts table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("part")}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t("seoTitle")}</TableHead>
                      <TableHead className="text-center w-20">{t("description")}</TableHead>
                      <TableHead className="text-center w-20">{t("ogImage")}</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parts.map((part) => {
                      const title = getGeneratedTitle(part);
                      const hasDesc = part.description && part.description.trim().length > 0;
                      const hasPhoto = part.photos && part.photos.length > 0;
                      const titleLong = title.length > 60;

                      return (
                        <TableRow key={part.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {hasPhoto ? (
                                <div className="relative h-8 w-8 rounded overflow-hidden shrink-0">
                                  <Image src={part.photos![0]} alt="" fill className="object-cover" />
                                </div>
                              ) : (
                                <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                                  <Package className="h-3 w-3 text-muted-foreground" />
                                </div>
                              )}
                              <span className="text-sm font-medium truncate max-w-[200px]">{part.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className={`text-xs truncate block max-w-[250px] ${titleLong ? "text-amber-600" : ""}`}>
                              {title}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {t("chars", { count: title.length })}
                              {titleLong && (
                                <span className="text-amber-600 ml-1">({t("tooLong")})</span>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {hasDesc ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {hasPhoto ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setPreviewId(part.id);
                                setTab("preview");
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Preview ── */}
        <TabsContent value="preview" className="space-y-4">
          {/* Part selector */}
          <Card>
            <CardContent className="p-4">
              <select
                className="w-full p-2 border rounded-md text-sm bg-background"
                value={previewId || ""}
                onChange={(e) => setPreviewId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">{t("selectPart")}</option>
                {parts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.year && p.make ? `(${p.year} ${p.make})` : ""}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          {previewPart && (
            <>
              {/* Google preview */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {t("googlePreview")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-w-[600px] space-y-1">
                    <p className="text-xl text-blue-700 hover:underline cursor-pointer leading-tight">
                      {getGeneratedTitle(previewPart)} | HuppeR Auto Parts
                    </p>
                    <p className="text-sm text-green-700">
                      {BASE_URL}/en/parts/{previewPart.id}
                    </p>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {getGeneratedDescription(previewPart)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* OG preview */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    {t("ogPreview")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-w-[500px] border rounded-lg overflow-hidden">
                    {previewPart.photos && previewPart.photos.length > 0 ? (
                      <div className="relative h-[260px] bg-muted">
                        <Image
                          src={previewPart.photos[0]}
                          alt=""
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-[260px] bg-muted flex items-center justify-center">
                        <Package className="h-12 w-12 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="p-3 space-y-1 bg-gray-50 border-t">
                      <p className="text-[10px] uppercase text-muted-foreground tracking-wider">
                        parts-inventory.onrender.com
                      </p>
                      <p className="font-semibold text-sm line-clamp-1">
                        {getGeneratedTitle(previewPart)} | HuppeR Auto Parts
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {getGeneratedDescription(previewPart)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {!previewPart && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Eye className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">{t("selectPart")}</p>
            </div>
          )}
        </TabsContent>

        {/* ── Issues ── */}
        <TabsContent value="issues" className="space-y-4">
          {/* Missing descriptions */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {t("noDescription")} ({analysis.missingDesc.length})
                </CardTitle>
                {analysis.missingDesc.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateDescriptions}
                    disabled={generating}
                  >
                    {generating ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {generating ? t("generating") : t("generateDesc")}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {analysis.missingDesc.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t("noIssues")}</p>
              ) : (
                <Table>
                  <TableBody>
                    {analysis.missingDesc.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{p.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {[p.year, p.make, p.model].filter(Boolean).join(" ") || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Missing photos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                {t("noPhotos")} ({analysis.missingPhoto.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {analysis.missingPhoto.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t("noIssues")}</p>
              ) : (
                <Table>
                  <TableBody>
                    {analysis.missingPhoto.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{p.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {[p.year, p.make, p.model].filter(Boolean).join(" ") || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Long titles */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {t("longTitle")} ({analysis.longTitle.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {analysis.longTitle.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t("noIssues")}</p>
              ) : (
                <Table>
                  <TableBody>
                    {analysis.longTitle.map((p) => {
                      const title = getGeneratedTitle(p);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm truncate max-w-[300px]">{title}</TableCell>
                          <TableCell className="text-xs text-amber-600">
                            {t("chars", { count: title.length })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Technical ── */}
        <TabsContent value="technical" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Sitemap */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {t("sitemap")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("sitemapDesc")}</p>
                <p className="text-sm">{t("sitemapParts", { count: analysis.total, total: analysis.total * 3 })}</p>
                <p className="text-sm">{t("sitemapStatic")}</p>
                <p className="text-xs font-mono text-muted-foreground mt-2">
                  {BASE_URL}/sitemap.xml
                </p>
              </CardContent>
            </Card>

            {/* Robots */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Code2 className="h-4 w-4" />
                  {t("robots")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-sm">{t("robotsAllow")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-sm">{t("robotsDisallow")}</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground mt-2">
                  {BASE_URL}/robots.txt
                </p>
              </CardContent>
            </Card>

            {/* JSON-LD */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Code2 className="h-4 w-4" />
                  {t("jsonLd")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-sm">{t("jsonLdHome")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-sm">{t("jsonLdPart")}</span>
                </div>
              </CardContent>
            </Card>

            {/* Canonical & Hreflang */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  {t("canonical")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-sm">{t("canonicalDesc")}</span>
                </div>
              </CardContent>
            </Card>

            {/* Meta Tags */}
            <Card className="sm:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  {t("metaTags")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-sm">{t("metaTagsDesc")}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
