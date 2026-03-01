"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Expense, ExpenseCategory } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

const supabase = createClient();

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "rent", "shipping", "tools", "supplies", "advertising", "fees", "other",
];

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  onSaved: () => void;
}

export function ExpenseDialog({ open, onOpenChange, expense, onSaved }: ExpenseDialogProps) {
  const t = useTranslations("admin.finances");
  const tc = useTranslations("admin.common");
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [description, setDescription] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    if (open) {
      if (expense) {
        setDate(expense.date);
        setAmount(expense.amount.toString());
        setCategory(expense.category);
        setDescription(expense.description || "");
        setIsRecurring(expense.is_recurring);
        setRecurringInterval(expense.recurring_interval || "monthly");
      } else {
        setDate(new Date().toISOString().split("T")[0]);
        setAmount("");
        setCategory("other");
        setDescription("");
        setIsRecurring(false);
        setRecurringInterval("monthly");
      }
    }
  }, [open, expense]);

  const handleSave = async () => {
    if (!date || !amount || parseFloat(amount) <= 0) {
      toast({ title: t("expenseValidation"), variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const record = {
        date,
        amount: parseFloat(amount),
        category,
        description: description.trim() || null,
        is_recurring: isRecurring,
        recurring_interval: isRecurring ? recurringInterval : null,
      };

      if (expense) {
        const { error } = await supabase
          .from("expenses")
          .update(record)
          .eq("id", expense.id);
        if (error) throw error;
        toast({ title: t("expenseUpdated") });
      } else {
        const { error } = await supabase
          .from("expenses")
          .insert(record);
        if (error) throw error;
        toast({ title: t("expenseAdded") });
      }

      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: t("expenseSaveError"), description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? t("editExpense") : t("addExpense")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("date")}</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t("amount")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>{t("category")}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {t(`categories.${cat}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t("description")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={2}
              className="mt-1"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="recurring" className="cursor-pointer">{t("recurring")}</Label>
            <Switch
              id="recurring"
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
            />
          </div>

          {isRecurring && (
            <div>
              <Label>{t("recurringInterval")}</Label>
              <Select value={recurringInterval} onValueChange={(v) => setRecurringInterval(v as "monthly" | "yearly")}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t("monthly")}</SelectItem>
                  <SelectItem value="yearly">{t("yearly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving || !date || !amount}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {expense ? t("update") : tc("save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
