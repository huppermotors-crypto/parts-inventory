"use client";

import { useState, useRef, useCallback } from "react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
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
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback(() => {
    // Set a default crop region (center 80%)
    const newCrop: Crop = {
      unit: "%",
      x: 10,
      y: 10,
      width: 80,
      height: 80,
    };
    setCrop(newCrop);
  }, []);

  const handleCrop = async () => {
    if (!completedCrop || !imgRef.current) return;
    setSaving(true);
    try {
      // Convert displayed pixel crop to natural image pixel crop
      const img = imgRef.current;
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;

      const naturalCrop = {
        x: Math.round(completedCrop.x * scaleX),
        y: Math.round(completedCrop.y * scaleY),
        width: Math.round(completedCrop.width * scaleX),
        height: Math.round(completedCrop.height * scaleY),
      };

      const blob = await cropImage(imageSrc, naturalCrop);
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
      setCrop(undefined);
      setCompletedCrop(undefined);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Crop Photo</DialogTitle>
        </DialogHeader>

        <div className="px-4 flex justify-center bg-black/5">
          {imageSrc && (
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              minWidth={20}
              minHeight={20}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop"
                onLoad={onImageLoad}
                style={{ maxHeight: "60vh", maxWidth: "100%" }}
                crossOrigin="anonymous"
              />
            </ReactCrop>
          )}
        </div>

        <DialogFooter className="p-4 pt-3">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCrop} disabled={saving || !completedCrop}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
