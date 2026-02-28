"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { decodeVIN } from "@/lib/nhtsa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { PhotoUploader, PhotoFile } from "@/components/admin/photo-uploader";

import { EbayPriceSearch } from "@/components/admin/ebay-price-search";
import { PART_CATEGORIES, PART_CONDITIONS } from "@/lib/constants";
import { getNextStockNumber } from "@/lib/stock-number";
import { normalizeMakeModel } from "@/lib/utils";
import {
  Search,
  Loader2,
  Save,
  Car,
  Tag,
  ImageIcon,
  Hash,
  History,
} from "lucide-react";

interface RecentVin {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
}

const supabase = createClient();

export default function AddPartPage() {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('admin.addPart');
  const tCat = useTranslations('categories');
  const tCond = useTranslations('conditions');

  // Form state
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [pricePer, setPricePer] = useState<"lot" | "item">("lot");
  const [condition, setCondition] = useState("used");
  const [category, setCategory] = useState("other");
  const [photos, setPhotos] = useState<PhotoFile[]>([]);

  // UI state
  const [decoding, setDecoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stockNumber, setStockNumber] = useState<string | null>(null);
  const [recentVins, setRecentVins] = useState<RecentVin[]>([]);

  // Load stock number and recent VINs on mount
  useEffect(() => {
    getNextStockNumber().then(setStockNumber).catch(() => {});

    const VIN_CACHE_KEY = "vin-decode-cache";

    function getVinCache(): Record<string, RecentVin> {
      try { return JSON.parse(localStorage.getItem(VIN_CACHE_KEY) || "{}"); } catch { return {}; }
    }

    function setVinCache(cache: Record<string, RecentVin>) {
      try { localStorage.setItem(VIN_CACHE_KEY, JSON.stringify(cache)); } catch {}
    }

    const loadRecentVins = async () => {
      // Load distinct VINs from DB (just vin field — ignore user-edited make/model)
      const { data, error } = await supabase
        .from("parts")
        .select("vin")
        .not("vin", "is", null)
        .neq("vin", "")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error || !data) return;

      const seen = new Set<string>();
      const uniqueVins: string[] = [];
      for (const row of data) {
        const v = (row.vin as string)?.trim();
        if (v && v.length === 17 && !seen.has(v)) {
          seen.add(v);
          uniqueVins.push(v);
          if (uniqueVins.length >= 5) break;
        }
      }

      // Decode each VIN via NHTSA (with localStorage cache)
      const cache = getVinCache();
      const results: RecentVin[] = [];

      for (const vinCode of uniqueVins) {
        if (cache[vinCode]) {
          results.push(cache[vinCode]);
          continue;
        }
        try {
          const decoded = await decodeVIN(vinCode);
          const entry: RecentVin = {
            vin: vinCode,
            year: decoded.year,
            make: decoded.make,
            model: decoded.model,
          };
          cache[vinCode] = entry;
          results.push(entry);
        } catch {
          results.push({ vin: vinCode, year: null, make: null, model: null });
        }
      }

      setVinCache(cache);
      setRecentVins(results);
    };

    loadRecentVins();
  }, []);


  // Track last auto-generated description to detect manual user edits
  const lastAutoDesc = useRef("");

  // Build vehicle prefix from year/make/model
  const buildVehiclePrefix = (y: string, m: string, md: string) =>
    [y, m, md].filter(Boolean).join(" ");

  // Update name prefix when vehicle info changes — returns new name
  const updateNamePrefix = (newYear: string, newMake: string, newModel: string): string => {
    const oldPrefix = buildVehiclePrefix(year, make, model);
    const newPrefix = buildVehiclePrefix(newYear, newMake, newModel);

    let newName: string;
    if (oldPrefix && name.startsWith(oldPrefix)) {
      const suffix = name.slice(oldPrefix.length);
      newName = newPrefix + suffix;
    } else if (!name.trim()) {
      newName = newPrefix ? newPrefix + " " : "";
    } else {
      newName = newPrefix ? newPrefix + " " + name : name;
    }
    setName(newName);
    return newName;
  };

  // Build auto-description from current fields (no duplicate info)
  const buildAutoDescription = (n: string, s: string, y: string, m: string, md: string): string => {
    const lines: string[] = [];
    const vehicle = buildVehiclePrefix(y, m, md);

    if (n.trim()) lines.push(n.trim());
    if (s.trim()) lines.push(`S/N: ${s.trim()}`);
    // Only add "Parts for" line if vehicle info is NOT already in the name
    if (vehicle && (!n || !n.toLowerCase().includes(vehicle.toLowerCase()))) {
      lines.push(`Parts for ${vehicle}`);
    }
    return lines.join("\n");
  };

  // Update description if it was auto-generated (don't overwrite user edits)
  const updateAutoDescription = (n?: string, s?: string, y?: string, m?: string, md?: string) => {
    const newDesc = buildAutoDescription(
      n ?? name, s ?? serialNumber, y ?? year, m ?? make, md ?? model
    );
    setDescription((prev) => {
      if (!prev.trim() || prev === lastAutoDesc.current) {
        lastAutoDesc.current = newDesc;
        return newDesc;
      }
      return prev; // user typed custom content — don't overwrite
    });
  };

  const handleDecode = async () => {
    const vinPattern = /^[A-HJ-NPR-Z0-9]{17}$/i;
    if (!vin || !vinPattern.test(vin)) {
      toast({
        title: "Invalid VIN",
        description: "VIN must be exactly 17 alphanumeric characters (no I, O, or Q).",
        variant: "destructive",
      });
      return;
    }

    setDecoding(true);
    try {
      const result = await decodeVIN(vin);
      const newYear = result.year?.toString() || "";
      const newMake = result.make || "";
      const newModel = result.model || "";

      if (result.year) setYear(newYear);
      if (result.make) setMake(newMake);
      if (result.model) setModel(newModel);

      const newName = updateNamePrefix(newYear, newMake, newModel);
      updateAutoDescription(newName, serialNumber, newYear, newMake, newModel);

      toast({
        title: "VIN Decoded",
        description: `${result.year} ${result.make} ${result.model}`,
      });
    } catch {
      toast({
        title: "Decode Failed",
        description: "Could not decode this VIN. Please fill in fields manually.",
        variant: "destructive",
      });
    } finally {
      setDecoding(false);
    }
  };

  const handleRecentVinSelect = (rv: RecentVin) => {
    setVin(rv.vin);
    const newYear = rv.year?.toString() || "";
    const newMake = rv.make || "";
    const newModel = rv.model || "";
    setYear(newYear);
    setMake(newMake);
    setModel(newModel);
    const newName = updateNamePrefix(newYear, newMake, newModel);
    updateAutoDescription(newName, serialNumber, newYear, newMake, newModel);
    toast({
      title: "VIN Selected",
      description: `${rv.year || ""} ${rv.make || ""} ${rv.model || ""}`.trim(),
    });
  };

  const uploadPhotos = async (): Promise<string[]> => {
    const urls: string[] = [];

    for (const photo of photos) {
      const fileExt = photo.file.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `parts/${fileName}`;

      const { error } = await supabase.storage
        .from("part-photos")
        .upload(filePath, photo.file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error("Upload error:", error);
        throw new Error(`Failed to upload photo: ${error.message}`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("part-photos").getPublicUrl(filePath);

      urls.push(publicUrl);
    }

    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a part name.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      // Upload photos first
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        photoUrls = await uploadPhotos();
      }

      // Get stock number (use pre-loaded or fetch fresh)
      const finalStockNumber = stockNumber || (await getNextStockNumber());

      // Insert part
      const { error } = await supabase.from("parts").insert({
        stock_number: finalStockNumber,
        vin: vin || null,
        year: year ? parseInt(year, 10) : null,
        make: make ? normalizeMakeModel(make) : null,
        model: model ? normalizeMakeModel(model) : null,
        name: name.trim(),
        description: description.trim() || null,
        serial_number: serialNumber.trim() || null,
        price: parseFloat(price) || 0,
        quantity: parseInt(quantity, 10) || 1,
        price_per: pricePer,
        condition,
        category,
        photos: photoUrls,
        is_published: true,
        is_sold: false,
      });

      if (error) throw error;

      toast({
        title: "Part Added",
        description: `"${name}" has been added to inventory.`,
      });

      router.push("/admin/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save part.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Add New Part</h1>
          <p className="text-muted-foreground mt-1">
            Add a new auto part to your inventory
          </p>
        </div>
        {stockNumber && (
          <div className="flex items-center gap-2 bg-muted rounded-lg px-4 py-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Stock #</p>
              <p className="text-lg font-mono font-bold">{stockNumber}</p>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* VIN Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Car className="h-5 w-5" />
              Vehicle Information
            </CardTitle>
            <CardDescription>
              Enter VIN to auto-fill vehicle details, or fill in manually
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* VIN Input Row */}
            <div className="space-y-2">
              <Label htmlFor="vin">VIN Code</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="vin"
                  placeholder="e.g. 1HGBH41JXMN109186"
                  value={vin}
                  onChange={(e) =>
                    setVin(e.target.value.toUpperCase().slice(0, 17))
                  }
                  maxLength={17}
                  className="font-mono flex-1 min-w-0 uppercase"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDecode}
                  disabled={decoding || vin.length !== 17}
                >
                  {decoding ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Decode
                </Button>
              </div>
              {vin && (
                <p className="text-xs text-muted-foreground">
                  {vin.length}/17 characters
                </p>
              )}
            </div>

            {/* Recent VINs picker */}
            {recentVins.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <History className="h-3 w-3" />
                  Recent VINs
                </Label>
                <div className="flex flex-wrap gap-2">
                  {recentVins.map((rv) => (
                    <button
                      key={rv.vin}
                      type="button"
                      onClick={() => handleRecentVinSelect(rv)}
                      className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <Badge variant="secondary" className="font-mono text-[10px] px-1.5">
                        {rv.vin.slice(-6)}
                      </Badge>
                      <span className="text-muted-foreground">
                        {[rv.year, rv.make, rv.model].filter(Boolean).join(" ") || rv.vin}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Vehicle Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  placeholder="2020"
                  value={year}
                  onChange={(e) => {
                    const v = e.target.value;
                    setYear(v);
                    const newName = updateNamePrefix(v, make, model);
                    updateAutoDescription(newName, serialNumber, v, make, model);
                  }}
                  min={1900}
                  max={2030}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="make">Make</Label>
                <Input
                  id="make"
                  placeholder="Toyota"
                  value={make}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMake(v);
                    const newName = updateNamePrefix(year, v, model);
                    updateAutoDescription(newName, serialNumber, year, v, model);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  placeholder="Camry"
                  value={model}
                  onChange={(e) => {
                    const v = e.target.value;
                    setModel(v);
                    const newName = updateNamePrefix(year, make, v);
                    updateAutoDescription(newName, serialNumber, year, make, v);
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Part Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Tag className="h-5 w-5" />
              Part Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g. Front Bumper, Engine ECU, Headlight Assembly"
                value={name}
                onChange={(e) => {
                  const v = e.target.value;
                  setName(v);
                  updateAutoDescription(v);
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the part condition, compatibility, any defects..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serial_number">Serial Number (S/N)</Label>
                <Input
                  id="serial_number"
                  placeholder="Part serial number"
                  value={serialNumber}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSerialNumber(v);
                    updateAutoDescription(undefined, v);
                  }}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">
                  Price ($) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  min={0}
                  step={0.01}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity in Lot</Label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Price Per</Label>
                <Select value={pricePer} onValueChange={(v) => setPricePer(v as "lot" | "item")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lot">Entire Lot</SelectItem>
                    <SelectItem value="item">Per Item</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    {PART_CONDITIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {PART_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* eBay Price Check */}
        <EbayPriceSearch
          partName={name}
          make={make || null}
          model={model || null}
          year={year ? parseInt(year, 10) : null}
          onPriceSelect={(p) => setPrice(p.toFixed(2))}
        />

        {/* Photos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ImageIcon className="h-5 w-5" />
              Photos
            </CardTitle>
            <CardDescription>
              Upload up to 10 photos. Images will be auto-compressed to
              &le;300KB each.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PhotoUploader photos={photos} onChange={setPhotos} />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/dashboard")}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Part
          </Button>
        </div>
      </form>

    </div>
  );
}
