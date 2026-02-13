"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Part } from "@/types/database";
import {
  PART_CATEGORIES,
  getCategoryLabel,
  getConditionLabel,
} from "@/lib/constants";
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
import { EditPartDialog } from "@/components/admin/edit-part-dialog";
import { DeletePartDialog } from "@/components/admin/delete-part-dialog";
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
  Package,
  Loader2,
  X,
  Layers,
  CarFront,
  Facebook,
  BadgeDollarSign,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

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

export default function DashboardPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMake, setFilterMake] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Force grid view on mobile (table is unusable on small screens)
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setViewMode("grid");
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

  const fetchParts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("parts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching parts:", error);
    } else {
      setParts(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  // Unique makes from data for the filter dropdown
  const uniqueMakes = useMemo(() => {
    const makes = parts
      .map((p) => p.make)
      .filter((m): m is string => !!m);
    return Array.from(new Set(makes)).sort();
  }, [parts]);

  // Unique categories from data for the filter dropdown
  const usedCategories = useMemo(() => {
    const cats = parts
      .map((p) => p.category)
      .filter((c): c is string => !!c);
    return Array.from(new Set(cats)).sort();
  }, [parts]);

  const filteredParts = useMemo(() => {
    return parts.filter((part) => {
      // Text search
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        part.name.toLowerCase().includes(q) ||
        (part.make && part.make.toLowerCase().includes(q)) ||
        (part.model && part.model.toLowerCase().includes(q)) ||
        (part.serial_number && part.serial_number.toLowerCase().includes(q)) ||
        (part.vin && part.vin.toLowerCase().includes(q));

      // Make filter
      const matchesMake =
        filterMake === "all" || part.make === filterMake;

      // Category filter
      const matchesCategory =
        filterCategory === "all" || part.category === filterCategory;

      return matchesSearch && matchesMake && matchesCategory;
    });
  }, [parts, search, filterMake, filterCategory]);

  const activeFiltersCount =
    (filterMake !== "all" ? 1 : 0) + (filterCategory !== "all" ? 1 : 0);

  const clearFilters = () => {
    setFilterMake("all");
    setFilterCategory("all");
    setSearch("");
  };

  const toggleSold = async (part: Part) => {
    const updates: Record<string, boolean> = { is_sold: !part.is_sold };
    if (!part.is_sold) {
      updates.is_published = false;
    } else {
      updates.is_published = true;
    }
    const { error } = await supabase
      .from("parts")
      .update(updates)
      .eq("id", part.id);

    if (!error) {
      fetchParts();
    }
  };

  const { toast } = useToast();

  const postToFB = (part: Part) => {
    const partData = {
      id: part.id,
      title: part.name,
      price: part.price,
      description: part.description || "",
      condition: part.condition,
      category: part.category,
      photos: part.photos || [],
      make: part.make || "",
      model: part.model || "",
      year: part.year || "",
      vin: part.vin || "",
      serial_number: part.serial_number || "",
    };

    // Write data to a hidden DOM element for the Chrome extension to pick up
    let el = document.getElementById("fb-post-part-data");
    if (!el) {
      el = document.createElement("div");
      el.id = "fb-post-part-data";
      el.style.display = "none";
      document.body.appendChild(el);
    }
    el.setAttribute("data-part", JSON.stringify(partData));

    // Dispatch custom event for the extension
    window.dispatchEvent(
      new CustomEvent("fb-post-part", { detail: partData })
    );

    toast({
      title: "Posting to FB Marketplace",
      description: `"${part.name}" — extension will open Facebook and fill the form.`,
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {parts.length} part{parts.length !== 1 ? "s" : ""} in inventory
            {filteredParts.length !== parts.length && (
              <span> &middot; {filteredParts.length} shown</span>
            )}
          </p>
        </div>
        <Link href="/admin/add">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Part
          </Button>
        </Link>
      </div>

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

        {/* Clear filters */}
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear filters
          </Button>
        )}

        {/* Spacer */}
        <div className="hidden sm:block sm:flex-1" />

        {/* View toggle (hidden on mobile, grid is forced) */}
        <div className="hidden sm:block">
          <Tabs
            value={viewMode}
            onValueChange={(v) => setViewMode(v as "table" | "grid")}
          >
            <TabsList>
              <TabsTrigger value="table" className="gap-1.5">
                <LayoutList className="h-4 w-4" />
                Table
              </TabsTrigger>
              <TabsTrigger value="grid" className="gap-1.5">
                <LayoutGrid className="h-4 w-4" />
                Grid
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredParts.length === 0 ? (
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
                  <TableHead className="w-16">Photo</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead className="w-40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParts.map((part) => (
                  <TableRow key={part.id}>
                    <TableCell>
                      {part.photos && part.photos.length > 0 ? (
                        <div className="relative h-10 w-10 rounded overflow-hidden">
                          <Image
                            src={part.photos[0]}
                            alt={part.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{part.name}</span>
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
                      {formatPrice(part.price)}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      <TooltipProvider delayDuration={300}>
                        <div className="flex gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => postToFB(part)}
                              >
                                <Facebook className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Post to FB</TooltipContent>
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
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredParts.map((part) => (
            <Card key={part.id} className="overflow-hidden group">
              <div className="aspect-video relative bg-muted">
                {part.photos && part.photos.length > 0 ? (
                  <Image
                    src={part.photos[0]}
                    alt={part.name}
                    fill
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
                <h3 className="font-medium truncate">{part.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {[part.year, part.make, part.model].filter(Boolean).join(" ") ||
                    "No vehicle info"}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold">{formatPrice(part.price)}</span>
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
        onDeleted={fetchParts}
      />
    </div>
  );
}
