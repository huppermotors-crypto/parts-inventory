"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Part } from "@/types/database";
import {
  PART_CATEGORIES,
  getCategoryLabel,
  getConditionLabel,
} from "@/lib/constants";
import { conditionColors, formatPrice, formatVehicle, normalizeMakeModel, getLotPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { EditPartDialog } from "@/components/admin/edit-part-dialog";
import { DeletePartDialog } from "@/components/admin/delete-part-dialog";
import { BulkPriceDialog } from "@/components/admin/bulk-price-dialog";
import { SellQuantityDialog } from "@/components/admin/sell-quantity-dialog";
import { MergeLotDialog } from "@/components/admin/merge-lot-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  PlusCircle,
  Search,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  LayoutGrid,
  LayoutList,
  Grid3X3,
  List,
  Package,
  Loader2,
  X,
  Layers,
  CarFront,
  Facebook,
  BadgeDollarSign,
  Undo2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  TrendingUp,
  BarChart3,
  ShoppingBag,
  Merge,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";


type SortField = "name" | "price" | "created_at" | "make" | "category" | "condition";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "live" | "sold";

const PAGE_SIZE = 25;

const supabase = createClient();

export default function DashboardPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMake, setFilterMake] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [filterNoVin, setFilterNoVin] = useState(false);
  const [filterOtherCategory, setFilterOtherCategory] = useState(false);
  const [filterNotOnFB, setFilterNotOnFB] = useState(false);
  const [filterNotOnEbay, setFilterNotOnEbay] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid" | "compact" | "list">("table");

  // Sort state
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [mergeLotOpen, setMergeLotOpen] = useState(false);

  // Force non-table view on mobile (table is unusable on small screens)
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setViewMode((v) => v === "table" ? "list" : v);
    };
    handler(mql);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Dialog states
  const [editPart, setEditPart] = useState<Part | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deletePart, setDeletePart] = useState<Part | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sellPart, setSellPart] = useState<Part | null>(null);
  const [sellOpen, setSellOpen] = useState(false);

  const { toast } = useToast();

  const fetchParts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("parts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching parts:", error);
      toast({ title: "Error", description: "Failed to load parts. Try refreshing.", variant: "destructive" });
    } else {
      setParts(data || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  // --- Stats ---
  const partLotPrice = (p: Part) => getLotPrice(p.price, p.quantity || 1, p.price_per || "lot");

  const stats = useMemo(() => {
    const total = parts.length;
    const live = parts.filter((p) => p.is_published && !p.is_sold).length;
    const sold = parts.filter((p) => p.is_sold).length;
    const inventoryValue = parts
      .filter((p) => !p.is_sold)
      .reduce((sum, p) => sum + partLotPrice(p), 0);
    const soldValue = parts
      .filter((p) => p.is_sold)
      .reduce((sum, p) => sum + partLotPrice(p), 0);
    return { total, live, sold, inventoryValue, soldValue };
  }, [parts]);

  // --- Status counts for tabs ---
  const statusCounts = useMemo(() => ({
    all: parts.length,
    live: parts.filter((p) => p.is_published && !p.is_sold).length,
    sold: parts.filter((p) => p.is_sold).length,
  }), [parts]);

  // Unique makes from data for the filter dropdown (case-insensitive dedup, normalized display)
  const uniqueMakes = useMemo(() => {
    const seen = new Map<string, string>(); // lowercase → normalized display
    for (const p of parts) {
      if (p.make) {
        const key = p.make.toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, normalizeMakeModel(p.make));
        }
      }
    }
    return Array.from(seen.values()).sort();
  }, [parts]);

  // Unique categories from data for the filter dropdown
  const usedCategories = useMemo(() => {
    const cats = parts
      .map((p) => p.category)
      .filter((c): c is string => !!c);
    return Array.from(new Set(cats)).sort();
  }, [parts]);

  // --- Filtering ---
  const filteredParts = useMemo(() => {
    return parts.filter((part) => {
      // Status filter
      if (filterStatus === "live" && (!part.is_published || part.is_sold)) return false;
      if (filterStatus === "sold" && !part.is_sold) return false;

      // Text search
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        part.name.toLowerCase().includes(q) ||
        (part.make && part.make.toLowerCase().includes(q)) ||
        (part.model && part.model.toLowerCase().includes(q)) ||
        (part.serial_number && part.serial_number.toLowerCase().includes(q)) ||
        (part.vin && part.vin.toLowerCase().includes(q));

      // Make filter (case-insensitive)
      const matchesMake =
        filterMake === "all" || (part.make && part.make.toLowerCase() === filterMake.toLowerCase());

      // Category filter
      const matchesCategory =
        filterCategory === "all" || part.category === filterCategory;

      // No VIN filter
      const matchesVin = !filterNoVin || !part.vin;

      // Other category filter
      const matchesOther = !filterOtherCategory || part.category === "other";

      // Not posted filters
      const matchesNotOnFB = !filterNotOnFB || !part.fb_posted_at;
      const matchesNotOnEbay = !filterNotOnEbay || !part.ebay_listed_at;

      return matchesSearch && matchesMake && matchesCategory && matchesVin && matchesOther && matchesNotOnFB && matchesNotOnEbay;
    });
  }, [parts, search, filterMake, filterCategory, filterStatus, filterNoVin, filterOtherCategory, filterNotOnFB, filterNotOnEbay]);

  // --- Sorting ---
  const sortedParts = useMemo(() => {
    const sorted = [...filteredParts].sort((a, b) => {
      const aVal: string | number | null = a[sortField] ?? null;
      const bVal: string | number | null = b[sortField] ?? null;

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (sortField === "price") {
        return sortDirection === "asc"
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const cmp = aStr.localeCompare(bStr);
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredParts, sortField, sortDirection]);

  // --- Pagination ---
  const totalPages = Math.max(1, Math.ceil(sortedParts.length / PAGE_SIZE));
  const paginatedParts = sortedParts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset page when filters/sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterMake, filterCategory, filterStatus, filterNoVin, filterOtherCategory, filterNotOnFB, filterNotOnEbay, sortField, sortDirection]);

  // Clear selection on filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, filterMake, filterCategory, filterStatus, filterNoVin, filterOtherCategory, filterNotOnFB, filterNotOnEbay]);

  const activeFiltersCount =
    (filterMake !== "all" ? 1 : 0) +
    (filterCategory !== "all" ? 1 : 0) +
    (filterStatus !== "all" ? 1 : 0) +
    (filterNoVin ? 1 : 0) +
    (filterOtherCategory ? 1 : 0) +
    (filterNotOnFB ? 1 : 0) +
    (filterNotOnEbay ? 1 : 0);

  const clearFilters = () => {
    setFilterMake("all");
    setFilterCategory("all");
    setFilterStatus("all");
    setFilterNoVin(false);
    setFilterOtherCategory(false);
    setFilterNotOnFB(false);
    setFilterNotOnEbay(false);
    setSearch("");
  };

  // --- Sort handler ---
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />;
    }
    return sortDirection === "asc"
      ? <ArrowUp className="h-3 w-3" />
      : <ArrowDown className="h-3 w-3" />;
  };

  // --- Selection helpers ---
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedParts.length && paginatedParts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedParts.map((p) => p.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  // --- Optimistic toggle sold ---
  const toggleSold = async (part: Part) => {
    if (!part.is_sold) {
      // Not yet sold — open sale confirmation dialog (for all parts)
      setSellPart(part);
      setSellOpen(true);
      return;
    }

    // Already sold — mark as available again
    const previousParts = [...parts];

    setParts((prev) =>
      prev.map((p) =>
        p.id === part.id
          ? { ...p, is_sold: false, is_published: true, sold_price: null, sold_at: null }
          : p
      )
    );

    const { error } = await supabase
      .from("parts")
      .update({ is_sold: false, is_published: true, sold_price: null, sold_at: null })
      .eq("id", part.id);

    if (error) {
      setParts(previousParts);
      toast({
        title: "Error",
        description: "Failed to update status. Reverted.",
        variant: "destructive",
      });
    }
  };

  // --- Sell with price confirmation ---
  const sellPartial = async (part: Part, soldQty: number, confirmedPrice: number) => {
    const previousParts = [...parts];
    const remainingQty = (part.quantity || 1) - soldQty;
    const allSold = remainingQty === 0;
    const now = new Date().toISOString();

    // Calculate remaining price for lot pricing
    const defaultSoldPrice = part.price_per === "item"
      ? part.price
      : (part.price / (part.quantity || 1)) * soldQty;
    const remainingPrice = part.price_per === "item"
      ? part.price
      : part.price - defaultSoldPrice;

    // If selling the whole lot (qty=1 or all items), just update the part
    if (allSold && soldQty === (part.quantity || 1)) {
      setParts((prev) =>
        prev.map((p) =>
          p.id === part.id
            ? { ...p, is_sold: true, is_published: false, sold_price: confirmedPrice, sold_at: now }
            : p
        )
      );

      const { error } = await supabase
        .from("parts")
        .update({ is_sold: true, is_published: false, sold_price: confirmedPrice, sold_at: now })
        .eq("id", part.id);

      if (error) {
        setParts(previousParts);
        toast({ title: "Error", description: "Failed to mark as sold.", variant: "destructive" });
        return;
      }

      toast({
        title: "Sold!",
        description: `"${part.name}" sold for $${confirmedPrice.toFixed(2)}`,
      });

      if (part.fb_posted_at) {
        toast({
          title: "Update Facebook!",
          description: `"${part.name}" was posted on FB — mark it as sold there too.`,
          duration: 10000,
        });
        window.open("https://www.facebook.com/marketplace/you/selling", "_blank");
      }
      return;
    }

    // Partial lot sell — create a sold record + update original
    setParts((prev) =>
      prev.map((p) =>
        p.id === part.id
          ? {
              ...p,
              quantity: remainingQty,
              price: part.price_per === "item" ? p.price : remainingPrice,
              is_sold: allSold,
              is_published: allSold ? false : p.is_published,
            }
          : p
      )
    );

    // 1. Create sold record in DB
    const { data: soldRecord, error: insertError } = await supabase
      .from("parts")
      .insert({
        name: part.name,
        description: part.description,
        vin: part.vin,
        year: part.year,
        make: part.make,
        model: part.model,
        serial_number: part.serial_number,
        price: part.price_per === "item" ? part.price : defaultSoldPrice,
        condition: part.condition,
        category: part.category,
        quantity: soldQty,
        price_per: part.price_per,
        photos: part.photos,
        is_published: false,
        is_sold: true,
        sold_price: confirmedPrice,
        sold_at: now,
      })
      .select()
      .single();

    if (insertError) {
      setParts(previousParts);
      toast({ title: "Error", description: "Failed to create sold record.", variant: "destructive" });
      return;
    }

    // 2. Update original part in DB
    const updateData: Record<string, unknown> = {
      quantity: remainingQty,
      ...(part.price_per === "lot" ? { price: remainingPrice } : {}),
      ...(allSold ? { is_sold: true, is_published: false, sold_price: confirmedPrice, sold_at: now } : {}),
    };

    const { error: updateError } = await supabase
      .from("parts")
      .update(updateData)
      .eq("id", part.id);

    if (updateError) {
      await supabase.from("parts").delete().eq("id", soldRecord.id);
      setParts(previousParts);
      toast({ title: "Error", description: "Failed to update original part.", variant: "destructive" });
      return;
    }

    setParts((prev) => [soldRecord, ...prev]);

    toast({
      title: "Partial Sale Recorded",
      description: `Sold ${soldQty} of "${part.name}" for $${confirmedPrice.toFixed(2)}. ${allSold ? "All sold." : `${remainingQty} remaining.`}`,
    });

    if (part.fb_posted_at && allSold) {
      toast({
        title: "Update Facebook!",
        description: `"${part.name}" was posted on FB — all items are now sold.`,
        duration: 10000,
      });
      window.open("https://www.facebook.com/marketplace/you/selling", "_blank");
    }
  };

  // --- Optimistic delete callback ---
  const handlePartDeleted = (partId: string) => {
    setParts((prev) => prev.filter((p) => p.id !== partId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(partId);
      return next;
    });
  };

  // --- Bulk operations ---
  const bulkMarkSold = async () => {
    const ids = Array.from(selectedIds);
    const previousParts = [...parts];

    setParts((prev) =>
      prev.map((p) =>
        ids.includes(p.id) ? { ...p, is_sold: true, is_published: false } : p
      )
    );
    clearSelection();

    const { error } = await supabase
      .from("parts")
      .update({ is_sold: true, is_published: false })
      .in("id", ids);

    if (error) {
      setParts(previousParts);
      toast({ title: "Error", description: "Bulk sold failed. Reverted.", variant: "destructive" });
    } else {
      toast({ title: "Bulk Update", description: `${ids.length} parts marked as sold.` });
    }
  };

  const bulkMarkAvailable = async () => {
    const ids = Array.from(selectedIds);
    const previousParts = [...parts];

    setParts((prev) =>
      prev.map((p) =>
        ids.includes(p.id) ? { ...p, is_sold: false, is_published: true } : p
      )
    );
    clearSelection();

    const { error } = await supabase
      .from("parts")
      .update({ is_sold: false, is_published: true })
      .in("id", ids);

    if (error) {
      setParts(previousParts);
      toast({ title: "Error", description: "Bulk update failed. Reverted.", variant: "destructive" });
    } else {
      toast({ title: "Bulk Update", description: `${ids.length} parts marked available.` });
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const partsToDelete = parts.filter((p) => ids.includes(p.id));
    const previousParts = [...parts];

    setParts((prev) => prev.filter((p) => !ids.includes(p.id)));
    clearSelection();

    try {
      const allPaths = partsToDelete.flatMap((p) =>
        (p.photos || []).map((url) => {
          const match = url.match(/part-photos\/(.+)$/);
          return match ? match[1] : "";
        }).filter(Boolean)
      );
      if (allPaths.length > 0) {
        await supabase.storage.from("part-photos").remove(allPaths);
      }

      const { error } = await supabase.from("parts").delete().in("id", ids);
      if (error) throw error;

      toast({ title: "Bulk Delete", description: `${ids.length} parts deleted.` });
    } catch {
      setParts(previousParts);
      toast({ title: "Error", description: "Bulk delete failed. Reverted.", variant: "destructive" });
    }
  };

  const handleBulkPriceUpdate = async (mode: string, value: number) => {
    const ids = Array.from(selectedIds);
    const previousParts = [...parts];

    const updatedParts = parts.map((p) => {
      if (!ids.includes(p.id)) return p;
      let newPrice = p.price;
      switch (mode) {
        case "set": newPrice = value; break;
        case "increase": newPrice = p.price + value; break;
        case "decrease": newPrice = Math.max(0, p.price - value); break;
        case "percent_increase": newPrice = p.price * (1 + value / 100); break;
      }
      return { ...p, price: Math.round(newPrice * 100) / 100 };
    });

    setParts(updatedParts);
    clearSelection();

    try {
      // Batch updates in groups of 10 to reduce DB round-trips
      const toUpdate = updatedParts.filter((p) => ids.includes(p.id));
      const BATCH_SIZE = 10;
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const batch = toUpdate.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map((p) =>
            supabase.from("parts").update({ price: p.price }).eq("id", p.id)
          )
        );
        const failed = results.some((r) => r.error);
        if (failed) throw new Error("Some updates failed");
      }

      toast({ title: "Prices Updated", description: `${ids.length} parts updated.` });
    } catch {
      setParts(previousParts);
      toast({ title: "Error", description: "Price update failed. Reverted.", variant: "destructive" });
    }
  };

  // Get selected parts in selection order (first checked = primary)
  const selectedPartsForMerge = useMemo(() => {
    return parts.filter((p) => selectedIds.has(p.id));
  }, [parts, selectedIds]);

  const handleMergeLot = async (
    primaryId: string,
    mergedIds: string[],
    updates: { name: string; quantity: number; price: number; price_per: "lot" | "item"; description: string | null; photos: string[] }
  ) => {
    const previousParts = [...parts];

    // Optimistic: update primary, remove merged
    setParts((prev) =>
      prev
        .map((p) => (p.id === primaryId ? { ...p, ...updates } : p))
        .filter((p) => !mergedIds.includes(p.id))
    );
    clearSelection();

    try {
      // Update primary part
      const { error: updateErr } = await supabase
        .from("parts")
        .update({
          name: updates.name,
          quantity: updates.quantity,
          price: updates.price,
          price_per: updates.price_per,
          description: updates.description,
          photos: updates.photos,
        })
        .eq("id", primaryId);
      if (updateErr) throw updateErr;

      // Delete merged parts
      const { error: deleteErr } = await supabase
        .from("parts")
        .delete()
        .in("id", mergedIds);
      if (deleteErr) throw deleteErr;

      toast({ title: "Merged", description: `${mergedIds.length + 1} parts merged into 1 lot.` });
    } catch {
      setParts(previousParts);
      toast({ title: "Error", description: "Merge failed. Reverted.", variant: "destructive" });
    }
  };

  const postToFB = async (part: Part) => {
    // Merge photos from all selected parts (if any are selected)
    const allPhotos = [...(part.photos || [])];
    let mergedCount = 0;

    if (selectedIds.size > 0) {
      const otherSelectedParts = parts.filter(
        (p) => selectedIds.has(p.id) && p.id !== part.id
      );
      for (const sp of otherSelectedParts) {
        if (sp.photos && sp.photos.length > 0) {
          allPhotos.push(...sp.photos);
          mergedCount++;
        }
      }
    }

    const partData = {
      id: part.id,
      title: part.name,
      price: partLotPrice(part),
      description: part.description || "",
      condition: part.condition,
      category: part.category,
      photos: allPhotos,
      make: part.make || "",
      model: part.model || "",
      year: part.year || "",
      vin: part.vin || "",
      serial_number: part.serial_number || "",
      quantity: part.quantity || 1,
      price_per: part.price_per || "lot",
    };

    window.dispatchEvent(
      new CustomEvent("fb-post-part", { detail: partData })
    );

    // Mark as posted to FB
    const now = new Date().toISOString();
    setParts((prev) =>
      prev.map((p) => (p.id === part.id ? { ...p, fb_posted_at: now } : p))
    );
    await supabase
      .from("parts")
      .update({ fb_posted_at: now })
      .eq("id", part.id);

    toast({
      title: "Posting to FB Marketplace",
      description: mergedCount > 0
        ? `"${part.name}" with ${allPhotos.length} photos from ${mergedCount + 1} parts — extension will open Facebook.`
        : `"${part.name}" — extension will open Facebook and fill the form.`,
    });
  };

  const resetFBStatus = async (part: Part) => {
    if (!confirm(`Remove "${part.name}" from Facebook?`)) return;
    setParts((prev) =>
      prev.map((p) => (p.id === part.id ? { ...p, fb_posted_at: null } : p))
    );
    await supabase
      .from("parts")
      .update({ fb_posted_at: null })
      .eq("id", part.id);

    toast({
      title: "FB Status Reset",
      description: `"${part.name}" — removed from Facebook.`,
    });
  };

  const postToEbay = async (part: Part) => {
    const allPhotos = [...(part.photos || [])];
    let mergedCount = 0;

    if (selectedIds.size > 0) {
      const otherSelectedParts = parts.filter(
        (p) => selectedIds.has(p.id) && p.id !== part.id
      );
      for (const sp of otherSelectedParts) {
        if (sp.photos && sp.photos.length > 0) {
          allPhotos.push(...sp.photos);
          mergedCount++;
        }
      }
    }

    const partData = {
      id: part.id,
      title: part.name,
      price: partLotPrice(part),
      description: part.description || "",
      condition: part.condition,
      category: part.category,
      photos: allPhotos,
      make: part.make || "",
      model: part.model || "",
      year: part.year || "",
      vin: part.vin || "",
      serial_number: part.serial_number || "",
      quantity: part.quantity || 1,
      price_per: part.price_per || "lot",
    };

    window.dispatchEvent(
      new CustomEvent("ebay-post-part", { detail: partData })
    );

    const now = new Date().toISOString();
    setParts((prev) =>
      prev.map((p) => (p.id === part.id ? { ...p, ebay_listed_at: now } : p))
    );
    await supabase
      .from("parts")
      .update({ ebay_listed_at: now })
      .eq("id", part.id);

    toast({
      title: "Posting to eBay",
      description: mergedCount > 0
        ? `"${part.name}" with ${allPhotos.length} photos from ${mergedCount + 1} parts — extension will open eBay.`
        : `"${part.name}" — extension will open eBay.`,
    });
  };

  const resetEbayStatus = async (part: Part) => {
    if (!confirm(`Remove "${part.name}" from eBay?`)) return;
    setParts((prev) =>
      prev.map((p) =>
        p.id === part.id
          ? { ...p, ebay_listed_at: null, ebay_listing_id: null, ebay_offer_id: null, ebay_listing_url: null }
          : p
      )
    );
    await supabase
      .from("parts")
      .update({ ebay_listed_at: null, ebay_listing_id: null, ebay_offer_id: null, ebay_listing_url: null })
      .eq("id", part.id);

    toast({
      title: "eBay Status Reset",
      description: `"${part.name}" — removed from eBay.`,
    });
  };


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <Link href="/admin/add">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Part
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Package className="h-4 w-4" />
                <span className="text-sm">Total</span>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <Eye className="h-4 w-4" />
                <span className="text-sm">On Sale</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{stats.live}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-600 mb-1">
                <BadgeDollarSign className="h-4 w-4" />
                <span className="text-sm">Sold</span>
              </div>
              <p className="text-2xl font-bold text-amber-600">{stats.sold}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">Inventory</span>
              </div>
              <p className="text-2xl font-bold">{formatPrice(stats.inventoryValue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <BarChart3 className="h-4 w-4" />
                <span className="text-sm">Sold Value</span>
              </div>
              <p className="text-2xl font-bold">{formatPrice(stats.soldValue)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Tabs */}
      <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
          <TabsTrigger value="live">Live ({statusCounts.live})</TabsTrigger>
          <TabsTrigger value="sold">Sold ({statusCounts.sold})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search parts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Make filter */}
        <Select value={filterMake} onValueChange={setFilterMake}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <CarFront className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All Makes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Makes</SelectItem>
            {uniqueMakes.map((make) => (
              <SelectItem key={make} value={make}>
                {make}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category filter */}
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <Layers className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {PART_CATEGORIES.filter((c) => usedCategories.includes(c.value)).map(
              (cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>

        {/* Quick filters */}
        <label className="flex items-center gap-2 cursor-pointer text-sm whitespace-nowrap">
          <Checkbox
            checked={filterNoVin}
            onCheckedChange={(checked) => setFilterNoVin(checked === true)}
          />
          No VIN
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm whitespace-nowrap">
          <Checkbox
            checked={filterOtherCategory}
            onCheckedChange={(checked) => setFilterOtherCategory(checked === true)}
          />
          Other
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm whitespace-nowrap">
          <Checkbox
            checked={filterNotOnFB}
            onCheckedChange={(checked) => setFilterNotOnFB(checked === true)}
          />
          Not on FB
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm whitespace-nowrap">
          <Checkbox
            checked={filterNotOnEbay}
            onCheckedChange={(checked) => setFilterNotOnEbay(checked === true)}
          />
          Not on eBay
        </label>

        {/* Clear filters */}
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear filters
          </Button>
        )}

        {/* Spacer */}
        <div className="hidden sm:block sm:flex-1" />

        {/* View toggle */}
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-r-none hidden sm:inline-flex"
            onClick={() => setViewMode("table")}
            title="Table"
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-none sm:border-x"
            onClick={() => setViewMode("grid")}
            title="Grid"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "compact" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-none border-x sm:border-x-0 sm:border-r"
            onClick={() => setViewMode("compact")}
            title="Compact"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-l-none"
            onClick={() => setViewMode("list")}
            title="List"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <Card className="border-primary">
          <CardContent className="py-3 px-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <Separator orientation="vertical" className="h-6" />
            <Button variant="outline" size="sm" onClick={bulkMarkSold}>
              <BadgeDollarSign className="h-4 w-4 mr-1" />
              Mark Sold
            </Button>
            <Button variant="outline" size="sm" onClick={bulkMarkAvailable}>
              <Undo2 className="h-4 w-4 mr-1" />
              Mark Available
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBulkPriceOpen(true)}>
              <DollarSign className="h-4 w-4 mr-1" />
              Change Price
            </Button>
            {selectedIds.size >= 2 && (
              <Button variant="outline" size="sm" onClick={() => setMergeLotOpen(true)}>
                <Merge className="h-4 w-4 mr-1" />
                Merge Lot
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={bulkDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sortedParts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No parts found</h3>
          <p className="text-muted-foreground mt-1">
            {search || activeFiltersCount > 0
              ? "Try adjusting your search or filters."
              : "Get started by adding your first part."}
          </p>
          {search || activeFiltersCount > 0 ? (
            <Button variant="outline" className="mt-4" onClick={clearFilters}>
              Clear all filters
            </Button>
          ) : (
            <Link href="/admin/add" className="mt-4">
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Part
              </Button>
            </Link>
          )}
        </div>
      ) : viewMode === "table" ? (
        /* Table View */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={paginatedParts.length > 0 && selectedIds.size === paginatedParts.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="w-[92px]">Photo</TableHead>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")}>
                    <div className="flex items-center gap-1">
                      Name {renderSortIcon("name")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("category")}>
                    <div className="flex items-center gap-1">
                      Category {renderSortIcon("category")}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("make")}>
                    <div className="flex items-center gap-1">
                      Vehicle {renderSortIcon("make")}
                    </div>
                  </TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort("price")}>
                    <div className="flex items-center gap-1 justify-end">
                      Price {renderSortIcon("price")}
                    </div>
                  </TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("created_at")}>
                    <div className="flex items-center gap-1">
                      Date {renderSortIcon("created_at")}
                    </div>
                  </TableHead>
                  <TableHead className="w-40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedParts.map((part) => (
                  <TableRow key={part.id} className={selectedIds.has(part.id) ? "bg-muted/50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(part.id)}
                        onCheckedChange={() => toggleSelect(part.id)}
                        aria-label={`Select ${part.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      {part.photos && part.photos.length > 0 ? (
                        <Link href={`/parts/${part.id}`} target="_blank">
                          <div className="relative h-[84px] w-[84px] rounded overflow-hidden">
                            <Image
                              src={part.photos[0]}
                              alt={part.name}
                              fill
                              sizes="84px"
                              className="object-cover"
                            />
                          </div>
                        </Link>
                      ) : (
                        <div className="h-[84px] w-[84px] rounded bg-muted flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {part.stock_number || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <Link
                          href={`/parts/${part.id}`}
                          target="_blank"
                          className="font-medium hover:text-primary hover:underline transition-colors"
                        >
                          {part.name}
                        </Link>
                        {part.serial_number && (
                          <p className="text-xs text-muted-foreground font-mono">
                            S/N: {part.serial_number}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">
                        {getCategoryLabel(part.category)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {part.make || part.model ? (
                        <span className="text-sm">
                          {[part.year, part.make, part.model]
                            .filter(Boolean)
                            .join(" ")}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={conditionColors[part.condition] || ""}
                      >
                        {getConditionLabel(part.condition)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <div>
                        {formatPrice(partLotPrice(part))}
                        {(part.quantity || 1) > 1 && (
                          <p className="text-[10px] text-muted-foreground font-normal">
                            {part.quantity} × {formatPrice(part.price_per === "item" ? part.price : part.price / part.quantity)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {part.is_sold ? (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                            <BadgeDollarSign className="h-3 w-3 mr-1" />
                            Sold
                          </Badge>
                        ) : part.is_published ? (
                          <Badge variant="default" className="bg-green-600">
                            <Eye className="h-3 w-3 mr-1" />
                            Live
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <EyeOff className="h-3 w-3 mr-1" />
                            Hidden
                          </Badge>
                        )}
                        {part.fb_posted_at && (
                          <Badge variant="outline" className="text-blue-600 border-blue-300 text-[10px]">
                            <Facebook className="h-2.5 w-2.5 mr-0.5" />
                            FB
                          </Badge>
                        )}
                        {part.ebay_listed_at && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px]">
                            <ShoppingBag className="h-2.5 w-2.5 mr-0.5" />
                            eBay
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(part.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider delayDuration={300}>
                        <div className="flex gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 ${
                                  part.fb_posted_at
                                    ? "text-green-600 hover:text-red-600 hover:bg-red-50"
                                    : "text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                }`}
                                onClick={() =>
                                  part.fb_posted_at
                                    ? resetFBStatus(part)
                                    : postToFB(part)
                                }
                              >
                                <Facebook className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {part.fb_posted_at
                                ? `On FB (${new Date(part.fb_posted_at).toLocaleDateString()}) — click to reset`
                                : "Post to FB"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 ${
                                  part.ebay_listed_at
                                    ? "text-green-600 hover:text-red-600 hover:bg-red-50"
                                    : "text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                }`}
                                onClick={() =>
                                  part.ebay_listed_at
                                    ? resetEbayStatus(part)
                                    : postToEbay(part)
                                }
                              >
                                <ShoppingBag className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {part.ebay_listed_at
                                ? `On eBay (${new Date(part.ebay_listed_at).toLocaleDateString()}) — click to reset`
                                : "Post to eBay"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditPart(part);
                                  setEditOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 ${
                                  part.is_sold
                                    ? "text-green-600 hover:text-green-700 hover:bg-green-50"
                                    : "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                }`}
                                onClick={() => toggleSold(part)}
                              >
                                {part.is_sold ? (
                                  <Undo2 className="h-4 w-4" />
                                ) : (
                                  <BadgeDollarSign className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {part.is_sold ? "Mark as Available" : "Mark as Sold"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  setDeletePart(part);
                                  setDeleteOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === "list" ? (
        /* List View */
        <div className="space-y-2">
          {paginatedParts.map((part) => {
            const vehicle = formatVehicle(part.year, part.make, part.model);
            return (
              <div
                key={part.id}
                className={`flex items-center gap-4 p-3 rounded-lg border hover:shadow-md transition-shadow ${selectedIds.has(part.id) ? "bg-muted/50 border-primary" : ""}`}
              >
                <Checkbox
                  checked={selectedIds.has(part.id)}
                  onCheckedChange={() => toggleSelect(part.id)}
                  aria-label={`Select ${part.name}`}
                />
                <Link href={`/parts/${part.id}`} target="_blank" className="shrink-0">
                  <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-muted">
                    {part.photos && part.photos.length > 0 ? (
                      <Image
                        src={part.photos[0]}
                        alt={part.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Package className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/parts/${part.id}`}
                      target="_blank"
                      className="font-semibold truncate hover:text-primary hover:underline"
                    >
                      {part.name}
                    </Link>
                    {part.stock_number && (
                      <span className="font-mono text-xs text-muted-foreground shrink-0">#{part.stock_number}</span>
                    )}
                  </div>
                  {vehicle && (
                    <p className="text-sm text-muted-foreground">{vehicle}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {getCategoryLabel(part.category)}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${conditionColors[part.condition] || ""}`}
                    >
                      {getConditionLabel(part.condition)}
                    </Badge>
                    {part.is_sold ? (
                      <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">Sold</Badge>
                    ) : part.is_published ? (
                      <Badge variant="default" className="text-xs bg-green-600">Live</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Hidden</Badge>
                    )}
                    {part.fb_posted_at && (
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                        <Facebook className="h-2.5 w-2.5 mr-0.5" />
                        FB
                      </Badge>
                    )}
                    {part.ebay_listed_at && (
                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                        <ShoppingBag className="h-2.5 w-2.5 mr-0.5" />
                        eBay
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold">{formatPrice(partLotPrice(part))}</span>
                  {(part.quantity || 1) > 1 && (
                    <p className="text-[10px] text-muted-foreground">
                      {part.quantity}× {formatPrice(part.price_per === "item" ? part.price : part.price / part.quantity)}/ea
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditPart(part);
                            setEditOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${part.is_sold ? "text-green-600" : "text-amber-600"}`}
                          onClick={() => toggleSold(part)}
                        >
                          {part.is_sold ? <Undo2 className="h-4 w-4" /> : <BadgeDollarSign className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{part.is_sold ? "Mark Available" : "Mark Sold"}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeletePart(part);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === "compact" ? (
        /* Compact Grid View */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {paginatedParts.map((part) => (
            <Card key={part.id} className="overflow-hidden group">
              <div className="aspect-square relative bg-muted">
                {part.photos && part.photos.length > 0 ? (
                  <Image
                    src={part.photos[0]}
                    alt={part.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute top-1 left-1 flex gap-1">
                  {part.is_sold && (
                    <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 px-1 py-0">Sold</Badge>
                  )}
                  {!part.is_sold && !part.is_published && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">Hidden</Badge>
                  )}
                </div>
                <div className="absolute top-1 right-1 flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Button variant="secondary" size="icon" className="h-6 w-6" onClick={() => { setEditPart(part); setEditOpen(true); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className={`h-6 w-6 ${part.is_sold ? "text-green-600" : "text-amber-600"}`}
                    onClick={() => toggleSold(part)}
                  >
                    {part.is_sold ? <Undo2 className="h-3 w-3" /> : <BadgeDollarSign className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              <CardContent className="p-2">
                <h3 className="font-medium text-sm truncate">{part.name}</h3>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-bold text-sm">{formatPrice(partLotPrice(part))}</span>
                  <Badge variant="secondary" className={`text-[10px] ${conditionColors[part.condition] || ""}`}>
                    {getConditionLabel(part.condition)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedParts.map((part) => (
            <Card key={part.id} className="overflow-hidden group">
              <div className="aspect-video relative bg-muted">
                {part.photos && part.photos.length > 0 ? (
                  <Image
                    src={part.photos[0]}
                    alt={part.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Package className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                {/* Overlay badges */}
                <div className="absolute top-2 left-2 flex gap-1.5">
                  {part.is_sold ? (
                    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                      Sold
                    </Badge>
                  ) : !part.is_published ? (
                    <Badge variant="secondary" className="text-xs">
                      <EyeOff className="h-3 w-3 mr-1" />
                      Hidden
                    </Badge>
                  ) : null}
                  {part.fb_posted_at && (
                    <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                      <Facebook className="h-2.5 w-2.5 mr-0.5" />
                      FB
                    </Badge>
                  )}
                  {part.ebay_listed_at && (
                    <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                      <ShoppingBag className="h-2.5 w-2.5 mr-0.5" />
                      eBay
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs bg-white/80 text-black">
                    {getCategoryLabel(part.category)}
                  </Badge>
                </div>
                {/* Action buttons */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 sm:h-7 sm:w-7"
                    onClick={() => {
                      setEditPart(part);
                      setEditOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className={`h-8 w-8 sm:h-7 sm:w-7 ${
                      part.is_sold ? "text-green-600" : "text-amber-600"
                    }`}
                    onClick={() => toggleSold(part)}
                  >
                    {part.is_sold ? (
                      <Undo2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    ) : (
                      <BadgeDollarSign className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 sm:h-7 sm:w-7 text-destructive"
                    onClick={() => {
                      setDeletePart(part);
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-4">
                {part.stock_number && (
                  <span className="font-mono text-xs text-muted-foreground">#{part.stock_number}</span>
                )}
                <h3 className="font-medium truncate">{part.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {formatVehicle(part.year, part.make, part.model) || "No vehicle info"}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <div>
                    <span className="font-bold">{formatPrice(partLotPrice(part))}</span>
                    {(part.quantity || 1) > 1 && (
                      <p className="text-[10px] text-muted-foreground">{part.quantity}× {formatPrice(part.price_per === "item" ? part.price : part.price / part.quantity)}/ea</p>
                    )}
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${conditionColors[part.condition] || ""}`}
                  >
                    {getConditionLabel(part.condition)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            {(currentPage - 1) * PAGE_SIZE + 1}&ndash;{Math.min(currentPage * PAGE_SIZE, sortedParts.length)} of {sortedParts.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <EditPartDialog
        part={editPart}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={fetchParts}
      />
      <DeletePartDialog
        part={deletePart}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={handlePartDeleted}
      />
      <BulkPriceDialog
        open={bulkPriceOpen}
        onOpenChange={setBulkPriceOpen}
        count={selectedIds.size}
        onApply={handleBulkPriceUpdate}
      />
      <SellQuantityDialog
        part={sellPart}
        open={sellOpen}
        onOpenChange={setSellOpen}
        onConfirm={sellPartial}
      />
      <MergeLotDialog
        parts={selectedPartsForMerge}
        open={mergeLotOpen}
        onOpenChange={setMergeLotOpen}
        onConfirm={handleMergeLot}
      />
    </div>
  );
}
