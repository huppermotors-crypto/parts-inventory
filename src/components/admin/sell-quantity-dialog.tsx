"use client";

import { useState, useEffect } from "react";
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
  onConfirm: (part: Part, quantity: number, soldPrice: number) => void;
}

export function SellQuantityDialog({
  part,
  open,
  onOpenChange,
  onConfirm,
}: SellQuantityDialogProps) {
  const [qty, setQty] = useState(1);
  const [soldPrice, setSoldPrice] = useState("");

  const maxQty = part?.quantity || 1;
  const showQtyPicker = maxQty > 1;
  const unitPrice = part
    ? part.price_per === "item"
      ? part.price
      : part.price / (part.quantity || 1)
    : 0;

  // Reset on open
  useEffect(() => {
    if (open && part) {
      setQty(showQtyPicker ? 1 : maxQty);
      // Default sold price = listing price (for the qty being sold)
      const defaultPrice = showQtyPicker
        ? unitPrice
        : part.price_per === "item"
          ? part.price * (part.quantity || 1)
          : part.price;
      setSoldPrice(defaultPrice.toFixed(2));
    }
  }, [open, part]);

  const handleConfirm = () => {
    if (!part) return;
    const price = parseFloat(soldPrice) || 0;
    if (price <= 0) return;
    if (qty > 0 && qty <= maxQty) {
      onConfirm(part, qty, price);
      onOpenChange(false);
    }
  };

  if (!part) return null;

  const suggestedPrice = qty * unitPrice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Confirm Sale</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{part.name}</span>
            {showQtyPicker && ` — ${maxQty} pcs available`}
          </p>

          {/* Quantity picker — only for lots > 1 */}
          {showQtyPicker && (
            <div className="space-y-2">
              <Label>How many sold?</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => {
                    const newQty = Math.max(1, qty - 1);
                    setQty(newQty);
                    setSoldPrice((newQty * unitPrice).toFixed(2));
                  }}
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
                    const v = Math.min(Math.max(1, parseInt(e.target.value) || 1), maxQty);
                    setQty(v);
                    setSoldPrice((v * unitPrice).toFixed(2));
                  }}
                  className="text-center text-lg font-semibold"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => {
                    const newQty = Math.min(maxQty, qty + 1);
                    setQty(newQty);
                    setSoldPrice((newQty * unitPrice).toFixed(2));
                  }}
                  disabled={qty >= maxQty}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Sale price */}
          <div className="space-y-2">
            <Label>Sale price ($)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={soldPrice}
              onChange={(e) => setSoldPrice(e.target.value)}
              className="text-lg font-semibold"
              placeholder="0.00"
            />
            {parseFloat(soldPrice) !== suggestedPrice && (
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={() => setSoldPrice(suggestedPrice.toFixed(2))}
              >
                Reset to listing price: {formatPrice(suggestedPrice)}
              </button>
            )}
          </div>

          {/* Summary */}
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Listing price</span>
              <span className="font-medium">{formatPrice(suggestedPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sale price</span>
              <span className="font-bold text-green-700">
                {formatPrice(parseFloat(soldPrice) || 0)}
              </span>
            </div>
            {parseFloat(soldPrice) !== suggestedPrice && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Difference</span>
                <span
                  className={`font-medium ${
                    (parseFloat(soldPrice) || 0) < suggestedPrice
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {(parseFloat(soldPrice) || 0) >= suggestedPrice ? "+" : ""}
                  {formatPrice((parseFloat(soldPrice) || 0) - suggestedPrice)}
                </span>
              </div>
            )}
            {showQtyPicker && (
              <div className="flex justify-between pt-1 border-t">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-medium">
                  {maxQty - qty} pcs
                  {maxQty - qty === 0 && (
                    <span className="text-amber-600 ml-1">(all sold)</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!parseFloat(soldPrice) || parseFloat(soldPrice) <= 0}
          >
            Confirm Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
