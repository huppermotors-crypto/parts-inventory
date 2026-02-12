"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Part } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { PART_CATEGORIES, PART_CONDITIONS } from "@/lib/constants";
import { PhotoUploader, PhotoFile } from "@/components/admin/photo-uploader";
import { EbayPriceSearch } from "@/components/admin/ebay-price-search";
import { Loader2, Save, X, ImageIcon } from "lucide-react";
import Image from "next/image";

const supabase = createClient();

interface EditPartDialogProps {
  part: Part | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditPartDialog({
  part,
  open,
  onOpenChange,
  onSaved,
}: EditPartDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

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
  const [isPublished, setIsPublished] = useState(true);

  // Photo state
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<PhotoFile[]>([]);

  useEffect(() => {
    if (part) {
      setVin(part.vin || "");
      setYear(part.year?.toString() || "");
      setMake(part.make || "");
      setModel(part.model || "");
      setName(part.name);
      setDescription(part.description || "");
      setSerialNumber(part.serial_number || "");
      setPrice(part.price?.toString() || "0");
      setCondition(part.condition);
      setCategory(part.category || "other");
      setIsPublished(part.is_published);
      setExistingPhotos(part.photos || []);
      setNewPhotos([]);
    }
  }, [part]);

  const removeExistingPhoto = useCallback(
    (index: number) => {
      setExistingPhotos((prev) => prev.filter((_, i) => i !== index));
    },
    []
  );

  const uploadNewPhotos = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const photo of newPhotos) {
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
        throw new Error(`Failed to upload photo: ${error.message}`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("part-photos").getPublicUrl(filePath);

      urls.push(publicUrl);
    }
    return urls;
  };

  const handleSave = async () => {
    if (!part) return;
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
      // Upload new photos
      let newPhotoUrls: string[] = [];
      if (newPhotos.length > 0) {
        newPhotoUrls = await uploadNewPhotos();
      }

      // Combine existing + new
      const allPhotos = [...existingPhotos, ...newPhotoUrls];

      // Delete removed photos from storage
      if (part.photos) {
        const removedUrls = part.photos.filter(
          (url) => !existingPhotos.includes(url)
        );
        if (removedUrls.length > 0) {
          const paths = removedUrls
            .map((url) => {
              const match = url.match(/part-photos\/(.+)$/);
              return match ? match[1] : "";
            })
            .filter(Boolean);
          if (paths.length > 0) {
            await supabase.storage.from("part-photos").remove(paths);
          }
        }
      }

      const { error } = await supabase
        .from("parts")
        .update({
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
          is_published: isPublished,
          photos: allPhotos,
        })
        .eq("id", part.id);

      if (error) throw error;

      toast({
        title: "Part Updated",
        description: `"${name}" has been updated.`,
      });

      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update part.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const totalPhotos = existingPhotos.length + newPhotos.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Edit Part</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-2 sm:col-span-4">
              <Label>VIN</Label>
              <Input
                value={vin}
                onChange={(e) =>
                  setVin(e.target.value.toUpperCase().slice(0, 17))
                }
                maxLength={17}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Make</Label>
              <Input value={make} onChange={(e) => setMake(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Model</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Name <span className="text-destructive">*</span>
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Price ($)</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min={0}
                step={0.01}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
                  <SelectValue />
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
              <Label>Published</Label>
              <Select
                value={isPublished ? "yes" : "no"}
                onValueChange={(v) => setIsPublished(v === "yes")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Published</SelectItem>
                  <SelectItem value="no">Hidden</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* eBay Price Check */}
          <EbayPriceSearch
            partName={name}
            make={make || null}
            model={model || null}
            year={year ? parseInt(year, 10) : null}
            onPriceSelect={(p) => setPrice(p.toFixed(2))}
          />

          {/* Photos Section */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Photos ({totalPhotos}/10)
            </Label>

            {/* Existing photos */}
            {existingPhotos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {existingPhotos.map((url, index) => (
                  <div
                    key={url}
                    className="relative group rounded-lg overflow-hidden border aspect-square"
                  >
                    <Image
                      src={url}
                      alt={`Photo ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-7 w-7 sm:h-6 sm:w-6 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      onClick={() => removeExistingPhoto(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new photos */}
            {totalPhotos < 10 && (
              <PhotoUploader
                photos={newPhotos}
                onChange={setNewPhotos}
                maxPhotos={10 - existingPhotos.length}
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
