"use client";

import { useState } from "react";
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
import { Minus, Plus } from "lucide-react";
import type { Part } from "@/types/database";
import { formatPrice } from "@/lib/utils";

interface SellQuantityDialogProps {
  part: Part | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (part: Part, quantity: number) => void;
}

export function SellQuantityDialog({
  part,
  open,
  onOpenChange,
  onConfirm,
}: SellQuantityDialogProps) {
  const [qty, setQty] = useState(1);

  const maxQty = part?.quantity || 1;
  const unitPrice = part
    ? part.price_per === "item"
      ? part.price
      : part.price / (part.quantity || 1)
    : 0;

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) setQty(1);
    onOpenChange(isOpen);
  };

  const handleConfirm = () => {
    if (part && qty > 0 && qty <= maxQty) {
      onConfirm(part, qty);
      onOpenChange(false);
    }
  };

  if (!part) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Mark as Sold</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{part.name}</span>
            {" — "}
            {maxQty} pcs available
          </p>

          <div className="space-y-2">
            <Label>How many sold?</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min={1}
                max={maxQty}
                value={qty}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 1;
                  setQty(Math.min(Math.max(1, v), maxQty));
                }}
                className="text-center text-lg font-semibold"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                disabled={qty >= maxQty}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Selling</span>
              <span className="font-medium">
                {qty} × {formatPrice(unitPrice)} = {formatPrice(qty * unitPrice)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining</span>
              <span className="font-medium">
                {maxQty - qty} pcs
                {maxQty - qty === 0 && (
                  <span className="text-amber-600 ml-1">(all sold)</span>
                )}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Sell {qty} pc{qty > 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
