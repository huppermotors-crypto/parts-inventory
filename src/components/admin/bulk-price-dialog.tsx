"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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

interface BulkPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onApply: (mode: string, value: number) => void;
}

export function BulkPriceDialog({
  open,
  onOpenChange,
  count,
  onApply,
}: BulkPriceDialogProps) {
  const [mode, setMode] = useState("set");
  const [value, setValue] = useState("");

  const handleApply = () => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    onApply(mode, num);
    onOpenChange(false);
    setValue("");
    setMode("set");
  };

  const modeLabels: Record<string, string> = {
    set: "Set price to",
    increase: "Increase by $",
    decrease: "Decrease by $",
    percent_increase: "Increase by %",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Price</DialogTitle>
          <DialogDescription>
            Update price for {count} selected part{count !== 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(modeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{mode === "percent_increase" ? "Percentage" : "Amount ($)"}</Label>
            <Input
              type="number"
              min={0}
              step={mode === "percent_increase" ? 1 : 10}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === "percent_increase" ? "10" : "100"}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!value || parseFloat(value) < 0}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
