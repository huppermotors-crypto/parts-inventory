"use client";

import { useState, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/utils";
import type { Part } from "@/types/database";

interface MergeLotDialogProps {
  parts: Part[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (primaryId: string, mergedIds: string[], updates: {
    name: string;
    quantity: number;
    price: number;
    price_per: "lot" | "item";
    description: string | null;
    photos: string[];
  }) => void;
}

export function MergeLotDialog({
  parts,
  open,
  onOpenChange,
  onConfirm,
}: MergeLotDialogProps) {
  const primary = parts[0]; // first checked = primary
  const [name, setName] = useState("");
  const [pricePer, setPricePer] = useState<"lot" | "item">("lot");

  // Reset when dialog opens
  const totalQty = useMemo(() => {
    return parts.reduce((sum, p) => sum + (p.quantity || 1), 0);
  }, [parts]);

  const allPhotos = useMemo(() => {
    const photos: string[] = [];
    for (const p of parts) {
      for (const ph of p.photos || []) {
        if (!photos.includes(ph)) photos.push(ph);
      }
    }
    return photos;
  }, [parts]);

  const totalValue = useMemo(() => {
    return parts.reduce((sum, p) => {
      if (p.price_per === "item") return sum + p.price * (p.quantity || 1);
      return sum + p.price;
    }, 0);
  }, [parts]);

  // Use primary's values as defaults when dialog opens
  const effectiveName = name || primary?.name || "";
  const effectivePrice = primary?.price || 0;

  if (!primary || parts.length < 2) return null;

  const handleConfirm = () => {
    const mergedIds = parts.filter((p) => p.id !== primary.id).map((p) => p.id);
    onConfirm(primary.id, mergedIds, {
      name: effectiveName,
      quantity: totalQty,
      price: pricePer === "lot" ? totalValue : effectivePrice,
      price_per: pricePer,
      description: primary.description,
      photos: allPhotos,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Merge into Lot</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Parts being merged */}
          <div className="space-y-1">
            <Label className="text-muted-foreground">Merging {parts.length} parts:</Label>
            <div className="max-h-[150px] overflow-y-auto space-y-1">
              {parts.map((p, i) => (
                <div
                  key={p.id}
                  className={`text-sm px-2 py-1 rounded ${i === 0 ? "bg-primary/10 font-medium" : "bg-muted"}`}
                >
                  {i === 0 && <span className="text-xs text-primary mr-1">PRIMARY</span>}
                  {p.name} — qty: {p.quantity || 1} — {formatPrice(p.price_per === "item" ? p.price * (p.quantity || 1) : p.price)}
                </div>
              ))}
            </div>
          </div>

          {/* Lot name */}
          <div className="space-y-2">
            <Label>Lot name</Label>
            <Input
              value={effectiveName}
              onChange={(e) => setName(e.target.value)}
              placeholder={primary.name}
            />
          </div>

          {/* Price per */}
          <div className="space-y-2">
            <Label>Price type</Label>
            <Select value={pricePer} onValueChange={(v) => setPricePer(v as "lot" | "item")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lot">Per lot (total price)</SelectItem>
                <SelectItem value="item">Per item</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total quantity</span>
              <span className="font-bold">{totalQty} pcs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Photos</span>
              <span className="font-medium">{allPhotos.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price</span>
              <span className="font-bold text-green-700">
                {pricePer === "lot"
                  ? formatPrice(totalValue) + " total"
                  : formatPrice(effectivePrice) + " × " + totalQty + " = " + formatPrice(effectivePrice * totalQty)
                }
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t">
              <span className="text-muted-foreground">Vehicle</span>
              <span className="font-medium">
                {[primary.year, primary.make, primary.model].filter(Boolean).join(" ") || "—"}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Merge {parts.length} → 1 Lot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
