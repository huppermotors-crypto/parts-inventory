"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, Loader2 } from "lucide-react";

interface VinScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (vin: string) => void;
}

export function VinScanner({ open, onOpenChange, onScan }: VinScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<unknown>(null);
  const readerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const startScanner = async () => {
      try {
        setError(null);
        setLoading(true);

        // Dynamic import to avoid SSR issues
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
          "html5-qrcode"
        );

        if (cancelled) return;

        // Responsive qrbox sizing
        const containerWidth = readerRef.current?.clientWidth || 300;
        const qrboxWidth = Math.min(containerWidth - 40, 350);
        const qrboxHeight = Math.min(Math.round(qrboxWidth * 0.43), 150);

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
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: qrboxWidth, height: qrboxHeight },
            aspectRatio: window.innerWidth < 640 ? 1.5 : 2,
          },
          (decodedText: string) => {
            const cleaned = decodedText.replace(/[^A-HJ-NPR-Z0-9]/gi, "");
            if (cleaned.length === 17) {
              onScan(cleaned.toUpperCase());
              handleStop();
              onOpenChange(false);
            }
          },
          () => {
            // Ignore scan failures
          }
        );
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setLoading(false);
        console.error("Scanner error:", err);
        const message =
          err instanceof Error ? err.message : String(err);
        if (message.includes("NotAllowed") || message.includes("Permission")) {
          setError(
            "Camera access denied. Please grant camera permissions in your browser settings."
          );
        } else if (message.includes("NotFound") || message.includes("no camera")) {
          setError("No camera found on this device.");
        } else {
          setError(
            `Could not start camera: ${message.slice(0, 100)}`
          );
        }
      }
    };

    // Delay to let dialog render
    const timeout = setTimeout(startScanner, 400);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      handleStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleStop = () => {
    const scanner = scannerRef.current as {
      stop: () => Promise<void>;
      clear: () => void;
    } | null;
    if (scanner) {
      scanner
        .stop()
        .then(() => {
          scanner.clear();
          scannerRef.current = null;
        })
        .catch(() => {
          scannerRef.current = null;
        });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) handleStop();
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
        <div className="space-y-4">
          <div
            id="vin-reader"
            ref={readerRef}
            className="w-full rounded-lg overflow-hidden min-h-[200px]"
          />
          {loading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting camera...
            </div>
          )}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
              {error}
            </div>
          )}
          <p className="text-sm text-muted-foreground text-center">
            Point your camera at the VIN barcode. The VIN will be automatically
            detected.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
