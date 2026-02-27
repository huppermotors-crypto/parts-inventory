"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { decodeVINFull } from "@/lib/nhtsa";
import { Vehicle, NHTSAFullDecodeResult } from "@/types/database";
import { normalizeMakeModel } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PhotoUploader, PhotoFile } from "@/components/admin/photo-uploader";
import { Search, Loader2, Save, Trash2 } from "lucide-react";
import Image from "next/image";

const supabase = createClient();

interface VehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null; // null = add mode
  onSaved: () => void;
}

export function VehicleDialog({ open, onOpenChange, vehicle, onSaved }: VehicleDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [decoding, setDecoding] = useState(false);

  // Form state
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [bodyClass, setBodyClass] = useState("");
  const [engineDisplacement, setEngineDisplacement] = useState("");
  const [engineCylinders, setEngineCylinders] = useState("");
  const [engineHp, setEngineHp] = useState("");
  const [engineTurbo, setEngineTurbo] = useState(false);
  const [driveType, setDriveType] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [notes, setNotes] = useState("");

  // Photos
  const [newPhotos, setNewPhotos] = useState<PhotoFile[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (vehicle) {
        setVin(vehicle.vin);
        setYear(vehicle.year?.toString() || "");
        setMake(vehicle.make || "");
        setModel(vehicle.model || "");
        setBodyClass(vehicle.body_class || "");
        setEngineDisplacement(vehicle.engine_displacement || "");
        setEngineCylinders(vehicle.engine_cylinders?.toString() || "");
        setEngineHp(vehicle.engine_hp || "");
        setEngineTurbo(vehicle.engine_turbo);
        setDriveType(vehicle.drive_type || "");
        setFuelType(vehicle.fuel_type || "");
        setPurchasePrice(vehicle.purchase_price?.toString() || "");
        setNotes(vehicle.notes || "");
        setExistingPhotos(vehicle.photos || []);
      } else {
        setVin("");
        setYear("");
        setMake("");
        setModel("");
        setBodyClass("");
        setEngineDisplacement("");
        setEngineCylinders("");
        setEngineHp("");
        setEngineTurbo(false);
        setDriveType("");
        setFuelType("");
        setPurchasePrice("");
        setNotes("");
        setExistingPhotos([]);
      }
      setNewPhotos([]);
      setPhotosToDelete([]);
    }
  }, [open, vehicle]);

  const handleDecode = async () => {
    const cleanVin = vin.trim().toUpperCase();
    if (cleanVin.length !== 17) {
      toast({ title: "VIN must be 17 characters", variant: "destructive" });
      return;
    }

    setDecoding(true);
    try {
      const result: NHTSAFullDecodeResult = await decodeVINFull(cleanVin);
      if (result.year) setYear(result.year.toString());
      if (result.make) setMake(result.make);
      if (result.model) setModel(result.model);
      if (result.body_class) setBodyClass(result.body_class);
      if (result.engine_displacement) setEngineDisplacement(result.engine_displacement);
      if (result.engine_cylinders) setEngineCylinders(result.engine_cylinders.toString());
      if (result.engine_hp) setEngineHp(result.engine_hp);
      setEngineTurbo(result.engine_turbo);
      if (result.drive_type) setDriveType(result.drive_type);
      if (result.fuel_type) setFuelType(result.fuel_type);
      toast({ title: "VIN decoded successfully" });
    } catch {
      toast({ title: "Failed to decode VIN", variant: "destructive" });
    } finally {
      setDecoding(false);
    }
  };

  const uploadPhotos = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const photo of newPhotos) {
      const fileExt = photo.file.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `vehicles/${fileName}`;

      const { error } = await supabase.storage
        .from("part-photos")
        .upload(filePath, photo.file, { cacheControl: "3600", upsert: false });

      if (error) throw new Error(`Failed to upload photo: ${error.message}`);

      const { data: { publicUrl } } = supabase.storage
        .from("part-photos")
        .getPublicUrl(filePath);

      urls.push(publicUrl);
    }
    return urls;
  };

  const deleteStoragePhotos = async (urls: string[]) => {
    for (const url of urls) {
      const match = url.match(/\/part-photos\/(.+)$/);
      if (match) {
        await supabase.storage.from("part-photos").remove([match[1]]);
      }
    }
  };

  const handleSave = async () => {
    const cleanVin = vin.trim().toUpperCase();
    if (cleanVin.length !== 17) {
      toast({ title: "VIN must be 17 characters", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Upload new photos
      const uploadedUrls = await uploadPhotos();

      // Delete removed photos from storage
      if (photosToDelete.length > 0) {
        await deleteStoragePhotos(photosToDelete);
      }

      // Combine existing (minus deleted) + new
      const keptPhotos = existingPhotos.filter((p) => !photosToDelete.includes(p));
      const allPhotos = [...keptPhotos, ...uploadedUrls];

      const record = {
        vin: cleanVin,
        year: year ? parseInt(year, 10) : null,
        make: make.trim() ? normalizeMakeModel(make.trim()) : null,
        model: model.trim() ? normalizeMakeModel(model.trim()) : null,
        body_class: bodyClass.trim() || null,
        engine_displacement: engineDisplacement.trim() || null,
        engine_cylinders: engineCylinders ? parseInt(engineCylinders, 10) : null,
        engine_hp: engineHp.trim() || null,
        engine_turbo: engineTurbo,
        drive_type: driveType.trim() || null,
        fuel_type: fuelType.trim() || null,
        purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
        notes: notes.trim() || null,
        photos: allPhotos,
      };

      if (vehicle) {
        const { error } = await supabase
          .from("vehicles")
          .update(record)
          .eq("id", vehicle.id);
        if (error) throw error;
        toast({ title: "Vehicle updated" });
      } else {
        const { error } = await supabase
          .from("vehicles")
          .insert(record);
        if (error) {
          if (error.code === "23505") {
            toast({ title: "Vehicle with this VIN already exists", variant: "destructive" });
            return;
          }
          throw error;
        }
        toast({ title: "Vehicle added" });
      }

      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Error saving vehicle", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeExistingPhoto = (url: string) => {
    setPhotosToDelete((prev) => [...prev, url]);
    setExistingPhotos((prev) => prev.filter((p) => p !== url));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* VIN + Decode */}
          <div>
            <Label>VIN</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                placeholder="Enter 17-character VIN"
                maxLength={17}
                className="font-mono"
                disabled={!!vehicle}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleDecode}
                disabled={decoding || vin.trim().length !== 17}
              >
                {decoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-1">Decode</span>
              </Button>
            </div>
          </div>

          {/* Year / Make / Model */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Year</Label>
              <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2021" className="mt-1" />
            </div>
            <div>
              <Label>Make</Label>
              <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Ford" className="mt-1" />
            </div>
            <div>
              <Label>Model</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="F-150" className="mt-1" />
            </div>
          </div>

          {/* Extended info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Body</Label>
              <Input value={bodyClass} onChange={(e) => setBodyClass(e.target.value)} placeholder="Pickup" className="mt-1" />
            </div>
            <div>
              <Label>Drive Type</Label>
              <Input value={driveType} onChange={(e) => setDriveType(e.target.value)} placeholder="4WD" className="mt-1" />
            </div>
          </div>

          {/* Engine row */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label>Engine</Label>
              <Input value={engineDisplacement} onChange={(e) => setEngineDisplacement(e.target.value)} placeholder="3.5L" className="mt-1" />
            </div>
            <div>
              <Label>Cylinders</Label>
              <Input value={engineCylinders} onChange={(e) => setEngineCylinders(e.target.value)} placeholder="6" className="mt-1" />
            </div>
            <div>
              <Label>HP</Label>
              <Input value={engineHp} onChange={(e) => setEngineHp(e.target.value)} placeholder="375" className="mt-1" />
            </div>
            <div>
              <Label>Fuel</Label>
              <Input value={fuelType} onChange={(e) => setFuelType(e.target.value)} placeholder="Gasoline" className="mt-1" />
            </div>
          </div>

          {/* Turbo checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="turbo"
              checked={engineTurbo}
              onChange={(e) => setEngineTurbo(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="turbo" className="cursor-pointer">Turbo</Label>
          </div>

          {/* Purchase Price */}
          <div>
            <Label>Purchase Price ($)</Label>
            <Input
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="0.00"
              type="number"
              step="0.01"
              min="0"
              className="mt-1"
            />
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about the vehicle..."
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Existing photos */}
          {existingPhotos.length > 0 && (
            <div>
              <Label>Current Photos</Label>
              <div className="grid grid-cols-5 gap-2 mt-1">
                {existingPhotos.map((url) => (
                  <div key={url} className="relative group aspect-square">
                    <Image
                      src={url}
                      alt="Vehicle"
                      fill
                      className="object-cover rounded-md"
                      unoptimized
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingPhoto(url)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New photos */}
          <div>
            <Label>{existingPhotos.length > 0 ? "Add More Photos" : "Photos"}</Label>
            <div className="mt-1">
              <PhotoUploader
                photos={newPhotos}
                onChange={setNewPhotos}
                maxPhotos={10 - existingPhotos.length}
              />
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || vin.trim().length !== 17}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {vehicle ? "Update" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
