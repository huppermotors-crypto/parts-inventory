"use client";

import { useCallback, useState } from "react";
import { compressImage, formatFileSize } from "@/lib/compress-image";
import { rotateImage } from "@/lib/rotate-image";
import { ImagePlus, X, Loader2, RotateCw, Crop } from "lucide-react";
import { CropDialog } from "./crop-dialog";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface PhotoFile {
  file: File;
  preview: string;
  originalSize: number;
  compressedSize: number;
}

interface PhotoUploaderProps {
  photos: PhotoFile[];
  onChange: (photos: PhotoFile[]) => void;
  maxPhotos?: number;
}

export type { PhotoFile };

export function PhotoUploader({
  photos,
  onChange,
  maxPhotos = 30,
}: PhotoUploaderProps) {
  const [compressing, setCompressing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [cropIndex, setCropIndex] = useState<number | null>(null);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter((f) =>
        f.type.startsWith("image/")
      );

      if (fileArray.length === 0) return;

      const remaining = maxPhotos - photos.length;
      const toProcess = fileArray.slice(0, remaining);

      if (toProcess.length === 0) return;

      setCompressing(true);

      try {
        const newPhotos: PhotoFile[] = await Promise.all(
          toProcess.map(async (file) => {
            const originalSize = file.size;
            const compressed = await compressImage(file);
            return {
              file: compressed,
              preview: URL.createObjectURL(compressed),
              originalSize,
              compressedSize: compressed.size,
            };
          })
        );

        onChange([...photos, ...newPhotos]);
      } catch (error) {
        console.error("Error processing images:", error);
      } finally {
        setCompressing(false);
      }
    },
    [photos, onChange, maxPhotos]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(e.target.files);
      }
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [processFiles]
  );

  const removePhoto = useCallback(
    (index: number) => {
      const newPhotos = [...photos];
      URL.revokeObjectURL(newPhotos[index].preview);
      newPhotos.splice(index, 1);
      onChange(newPhotos);
    },
    [photos, onChange]
  );

  const handleRotate = useCallback(
    async (index: number) => {
      const photo = photos[index];
      try {
        const rotatedBlob = await rotateImage(photo.preview);
        const rotatedFile = new File([rotatedBlob], photo.file.name, {
          type: "image/jpeg",
        });
        URL.revokeObjectURL(photo.preview);
        const newPreview = URL.createObjectURL(rotatedFile);
        const updatedPhotos = [...photos];
        updatedPhotos[index] = {
          ...photo,
          file: rotatedFile,
          preview: newPreview,
          compressedSize: rotatedFile.size,
        };
        onChange(updatedPhotos);
      } catch (error) {
        console.error("Rotation failed:", error);
      }
    },
    [photos, onChange]
  );

  const handleCrop = useCallback(
    (blob: Blob) => {
      if (cropIndex === null) return;
      const photo = photos[cropIndex];
      const croppedFile = new File([blob], photo.file.name, {
        type: "image/jpeg",
      });
      URL.revokeObjectURL(photo.preview);
      const newPreview = URL.createObjectURL(croppedFile);
      const updatedPhotos = [...photos];
      updatedPhotos[cropIndex] = {
        ...photo,
        file: croppedFile,
        preview: newPreview,
        compressedSize: croppedFile.size,
      };
      onChange(updatedPhotos);
      setCropIndex(null);
    },
    [photos, onChange, cropIndex]
  );

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <label
        className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50"
        } ${compressing ? "pointer-events-none opacity-50" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          className="hidden"
          accept="image/*"
          multiple
          onChange={handleFileInput}
          disabled={compressing || photos.length >= maxPhotos}
        />
        {compressing ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Compressing images...
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <ImagePlus className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Drag & drop images here, or click to select
            </span>
            <span className="text-xs text-muted-foreground">
              {photos.length}/{maxPhotos} photos &bull; Auto-compressed to
              &le;300KB
            </span>
          </div>
        )}
      </label>

      {/* Preview grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {photos.map((photo, index) => (
            <div key={index} className="relative group rounded-lg overflow-hidden border">
              <div className="aspect-square relative">
                <Image
                  src={photo.preview}
                  alt={`Photo ${index + 1}`}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="absolute top-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleRotate(index)}
                >
                  <RotateCw className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setCropIndex(index)}
                >
                  <Crop className="h-3 w-3" />
                </Button>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removePhoto(index)}
              >
                <X className="h-3 w-3" />
              </Button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5">
                {formatFileSize(photo.originalSize)} →{" "}
                {formatFileSize(photo.compressedSize)}
              </div>
            </div>
          ))}
        </div>
      )}
      {cropIndex !== null && (
        <CropDialog
          open={true}
          onOpenChange={(open) => { if (!open) setCropIndex(null); }}
          imageSrc={photos[cropIndex]?.preview || ""}
          onCrop={handleCrop}
        />
      )}
    </div>
  );
}
