"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, ImagePlus, Loader2, SwitchCamera } from "lucide-react";

interface VinScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (vin: string) => void;
}

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

function cleanVin(text: string): string | null {
  // Try exact 17-char match first
  const cleaned = text.replace(/[^A-HJ-NPR-Z0-9]/gi, "");
  if (cleaned.length === 17 && VIN_REGEX.test(cleaned)) {
    return cleaned.toUpperCase();
  }
  // Try to find a 17-char VIN substring
  const match = text.match(/[A-HJ-NPR-Z0-9]{17}/i);
  if (match) return match[0].toUpperCase();
  return null;
}

// Check if native BarcodeDetector is available
function hasBarcodeDetector(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

export function VinScanner({ open, onOpenChange, onScan }: VinScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"live" | "photo">("live");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleResult = useCallback(
    (vin: string) => {
      stopCamera();
      onScan(vin);
      onOpenChange(false);
    },
    [onScan, onOpenChange, stopCamera]
  );

  // --- Native BarcodeDetector live scanning ---
  const startNativeScanner = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // @ts-expect-error BarcodeDetector not in TS types yet
      const detector = new window.BarcodeDetector({
        formats: ["code_39", "code_128", "code_93", "qr_code", "data_matrix"],
      });

      setLoading(false);

      const scan = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          animFrameRef.current = requestAnimationFrame(scan);
          return;
        }
        try {
          const barcodes = await detector.detect(videoRef.current);
          for (const barcode of barcodes) {
            const vin = cleanVin(barcode.rawValue);
            if (vin) {
              handleResult(vin);
              return;
            }
          }
        } catch {
          // detect() can throw on some frames
        }
        animFrameRef.current = requestAnimationFrame(scan);
      };
      animFrameRef.current = requestAnimationFrame(scan);
    } catch (err) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("NotAllowed") || msg.includes("Permission")) {
        setError("Camera access denied. Grant camera permissions in browser settings.");
      } else {
        setError(`Camera error: ${msg.slice(0, 100)}`);
      }
    }
  }, [handleResult]);

  // --- html5-qrcode fallback live scanning ---
  const startFallbackScanner = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

      const container = document.getElementById("vin-reader");
      if (!container) return;

      const containerWidth = container.clientWidth || 300;
      const qrboxWidth = Math.min(containerWidth - 40, 320);
      const qrboxHeight = Math.min(Math.round(qrboxWidth * 0.43), 140);

      const scanner = new Html5Qrcode("vin-reader", {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
        verbose: false,
      });
      streamRef.current = { getTracks: () => [], scanner } as unknown as MediaStream;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: qrboxWidth, height: qrboxHeight },
          aspectRatio: window.innerWidth < 640 ? 1.5 : 2,
        },
        (decodedText: string) => {
          const vin = cleanVin(decodedText);
          if (vin) {
            scanner.stop().then(() => scanner.clear()).catch(() => {});
            handleResult(vin);
          }
        },
        () => {}
      );
      setLoading(false);
    } catch (err) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Scanner error: ${msg.slice(0, 100)}`);
    }
  }, [handleResult]);

  // --- Photo mode: scan from image file ---
  const scanPhoto = useCallback(
    async (file: File) => {
      setScanning(true);
      setError(null);

      try {
        const imageBitmap = await createImageBitmap(file);
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = imageBitmap.width;
        canvas.height = imageBitmap.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(imageBitmap, 0, 0);

        let vin: string | null = null;

        // Try native BarcodeDetector on the image
        if (hasBarcodeDetector()) {
          try {
            // @ts-expect-error BarcodeDetector not in TS types yet
            const detector = new window.BarcodeDetector({
              formats: ["code_39", "code_128", "code_93", "qr_code", "data_matrix"],
            });
            const barcodes = await detector.detect(canvas);
            for (const barcode of barcodes) {
              vin = cleanVin(barcode.rawValue);
              if (vin) break;
            }
          } catch {
            // fallthrough
          }
        }

        // Fallback: html5-qrcode scanFile
        if (!vin) {
          try {
            const { Html5Qrcode } = await import("html5-qrcode");
            const scanner = new Html5Qrcode("vin-photo-scan", { verbose: false });
            const result = await scanner.scanFile(file, false);
            vin = cleanVin(result);
            scanner.clear();
          } catch {
            // no barcode found
          }
        }

        if (vin) {
          handleResult(vin);
        } else {
          setError("No VIN barcode found in the photo. Try a clearer, closer photo of the barcode.");
        }
      } catch (err) {
        setError(`Photo scan error: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setScanning(false);
      }
    },
    [handleResult]
  );

  // Start/stop scanner based on dialog state
  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }

    if (mode === "live") {
      const timeout = setTimeout(() => {
        if (hasBarcodeDetector()) {
          startNativeScanner();
        } else {
          startFallbackScanner();
        }
      }, 300);
      return () => {
        clearTimeout(timeout);
        stopCamera();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  // Cleanup on unmount
  useEffect(() => stopCamera, [stopCamera]);

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) stopCamera();
        onOpenChange(val);
      }}
    >
      <DialogContent className="sm:max-w-lg max-w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Scan VIN Barcode
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Mode switcher */}
          <div className="flex gap-2">
            <Button
              variant={mode === "live" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => { stopCamera(); setMode("live"); setError(null); }}
            >
              <Camera className="h-4 w-4 mr-1.5" />
              Live Camera
            </Button>
            <Button
              variant={mode === "photo" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => { stopCamera(); setMode("photo"); setError(null); }}
            >
              <ImagePlus className="h-4 w-4 mr-1.5" />
              From Photo
            </Button>
          </div>

          {mode === "live" ? (
            <>
              {/* Native BarcodeDetector uses <video>, fallback uses div */}
              {hasBarcodeDetector() ? (
                <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  {/* Scan area overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-2 border-white/60 rounded-lg w-[80%] h-[40%]" />
                  </div>
                </div>
              ) : (
                <div
                  id="vin-reader"
                  className="w-full rounded-lg overflow-hidden min-h-[200px]"
                />
              )}
              {loading && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting camera...
                </div>
              )}
            </>
          ) : (
            <>
              {/* Photo mode */}
              <div className="flex flex-col items-center gap-3 py-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={scanning}
                >
                  {scanning ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <ImagePlus className="h-5 w-5 mr-2" />
                  )}
                  {scanning ? "Scanning..." : "Take Photo / Choose File"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) scanPhoto(file);
                    e.target.value = "";
                  }}
                />
                <p className="text-xs text-muted-foreground text-center max-w-[280px]">
                  Take a clear photo of the VIN barcode (door jamb sticker). Works best when the barcode fills most of the frame.
                </p>
              </div>
              {/* Hidden elements for html5-qrcode scanFile */}
              <div id="vin-photo-scan" className="hidden" />
              <canvas ref={canvasRef} className="hidden" />
            </>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
            <SwitchCamera className="h-3.5 w-3.5" />
            {mode === "live"
              ? hasBarcodeDetector()
                ? "Using native barcode scanner"
                : "Using html5-qrcode scanner"
              : "Take a photo and we'll scan it"}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
