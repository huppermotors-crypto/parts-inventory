"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { decodeVIN } from "@/lib/nhtsa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { VinScanner } from "@/components/admin/vin-scanner";
import { EbayPriceSearch } from "@/components/admin/ebay-price-search";
import { PART_CATEGORIES, PART_CONDITIONS } from "@/lib/constants";
import {
  ScanBarcode,
  Search,
  Loader2,
  Save,
  Car,
  Tag,
  ImageIcon,
} from "lucide-react";

const supabase = createClient();

export default function AddPartPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Form state
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState("used");
  const [category, setCategory] = useState("other");
  const [photos, setPhotos] = useState<PhotoFile[]>([]);

  // UI state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [saving, setSaving] = useState(false);

  // Build vehicle prefix from year/make/model
  const buildVehiclePrefix = (y: string, m: string, md: string) =>
    [y, m, md].filter(Boolean).join(" ");

  // Update name prefix when vehicle info changes
  const updateNamePrefix = (newYear: string, newMake: string, newModel: string) => {
    const oldPrefix = buildVehiclePrefix(year, make, model);
    const newPrefix = buildVehiclePrefix(newYear, newMake, newModel);

    if (oldPrefix && name.startsWith(oldPrefix)) {
      // Replace old prefix with new one
      const suffix = name.slice(oldPrefix.length);
      setName(newPrefix + suffix);
    } else if (!name.trim()) {
      // Name is empty — set prefix with trailing space
      setName(newPrefix ? newPrefix + " " : "");
    } else {
      // Name has custom content — prepend new prefix
      setName(newPrefix ? newPrefix + " " + name : name);
    }
  };

  const handleDecode = async () => {
    if (!vin || vin.length !== 17) {
      toast({
        title: "Invalid VIN",
        description: "VIN code must be exactly 17 characters.",
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

      updateNamePrefix(newYear, newMake, newModel);

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

  const handleVinScan = (scannedVin: string) => {
    setVin(scannedVin);
    toast({
      title: "VIN Scanned",
      description: `Detected VIN: ${scannedVin}`,
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

      // Insert part
      const { error } = await supabase.from("parts").insert({
        vin: vin || null,
        year: year ? parseInt(year, 10) : null,
        make: make || null,
        model: model || null,
        name: name.trim(),
        description: description.trim() || null,
        serial_number: serialNumber.trim() || null,
        price: parseFloat(price) || 0,
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
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Add New Part</h1>
        <p className="text-muted-foreground mt-1">
          Add a new auto part to your inventory
        </p>
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
                  className="font-mono flex-1 min-w-0"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Scan VIN"
                  onClick={() => setScannerOpen(true)}
                >
                  <ScanBarcode className="h-4 w-4" />
                </Button>
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
                    updateNamePrefix(v, make, model);
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
                    updateNamePrefix(year, v, model);
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
                    updateNamePrefix(year, make, v);
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
                onChange={(e) => setName(e.target.value)}
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
                  onChange={(e) => setSerialNumber(e.target.value)}
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

      {/* VIN Scanner Dialog */}
      <VinScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleVinScan}
      />
    </div>
  );
}
