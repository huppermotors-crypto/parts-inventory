"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cropImage } from "@/lib/crop-image";
import { Loader2 } from "lucide-react";

interface CropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCrop: (blob: Blob) => void;
}

export function CropDialog({ open, onOpenChange, imageSrc, onCrop }: CropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleCrop = async () => {
    if (!croppedArea) return;
    setSaving(true);
    try {
      const blob = await cropImage(imageSrc, croppedArea);
      onCrop(blob);
      onOpenChange(false);
    } catch (err) {
      console.error("Crop failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedArea(null);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Crop Photo</DialogTitle>
        </DialogHeader>

        <div className="relative w-full h-[400px] bg-black">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={undefined}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid
            />
          )}
        </div>

        <div className="px-4 py-3 flex items-center gap-3">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Zoom</span>
          <input
            type="range"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            min={1}
            max={3}
            step={0.1}
            className="flex-1 accent-primary"
          />
        </div>

        <DialogFooter className="p-4 pt-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCrop} disabled={saving || !croppedArea}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
