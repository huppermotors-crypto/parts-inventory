"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera } from "lucide-react";

interface VinScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (vin: string) => void;
}

export function VinScanner({ open, onOpenChange, onScan }: VinScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const startScanner = async () => {
      try {
        setError(null);
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
            qrbox: { width: 350, height: 150 },
            aspectRatio: 2,
          },
          (decodedText) => {
            // VIN codes are 17 characters
            const cleaned = decodedText.replace(/[^A-HJ-NPR-Z0-9]/gi, "");
            if (cleaned.length === 17) {
              onScan(cleaned.toUpperCase());
              handleStop();
              onOpenChange(false);
            }
          },
          () => {
            // Ignore scan failures (happens on every frame without a match)
          }
        );
      } catch (err) {
        console.error("Scanner error:", err);
        setError(
          "Could not access camera. Please make sure camera permissions are granted."
        );
      }
    };

    // Small delay to let the dialog render the div
    const timeout = setTimeout(startScanner, 300);

    return () => {
      clearTimeout(timeout);
      handleStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleStop = () => {
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .then(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        })
        .catch(() => {
          // Ignore stop errors
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
      <DialogContent className="sm:max-w-lg">
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
            className="w-full rounded-lg overflow-hidden"
          />
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
