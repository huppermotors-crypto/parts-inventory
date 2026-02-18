"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PriceRule } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Percent,
  DollarSign,
  Tag,
  TrendingUp,
  TrendingDown,
  Search,
} from "lucide-react";
import { Part } from "@/types/database";

const supabase = createClient();

interface RuleForm {
  type: "discount" | "markup";
  scope: "all" | "make" | "model" | "vin" | "part";
  scope_value: string;
  amount: string;
  amount_type: "percent" | "fixed";
  part_name: string;
}

const defaultForm: RuleForm = {
  type: "discount",
  scope: "all",
  scope_value: "",
  amount: "",
  amount_type: "percent",
  part_name: "",
};

export default function PricingPage() {
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PriceRule | null>(null);
  const [form, setForm] = useState<RuleForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [partSearch, setPartSearch] = useState("");
  const [partResults, setPartResults] = useState<Part[]>([]);
  const [searchingParts, setSearchingParts] = useState(false);
  const { toast } = useToast();

  const fetchRules = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("price_rules")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setRules(data || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const searchParts = useCallback(async (query: string) => {
    if (query.length < 2) { setPartResults([]); return; }
    setSearchingParts(true);
    const { data } = await supabase
      .from("parts")
      .select("id, name, make, model, year, price, stock_number")
      .or(`name.ilike.%${query}%,stock_number.ilike.%${query}%`)
      .limit(8);
    setPartResults((data || []) as Part[]);
    setSearchingParts(false);
  }, []);

  const openCreate = () => {
    setEditingRule(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = async (rule: PriceRule) => {
    setEditingRule(rule);
    let partName = "";
    if (rule.scope === "part" && rule.scope_value) {
      const { data } = await supabase
        .from("parts")
        .select("name")
        .eq("id", rule.scope_value)
        .single();
      partName = data?.name || rule.scope_value;
    }
    setForm({
      type: rule.type,
      scope: rule.scope,
      scope_value: rule.scope_value || "",
      amount: String(rule.amount),
      amount_type: rule.amount_type,
      part_name: partName,
    });
    setPartSearch("");
    setPartResults([]);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Amount must be greater than 0", variant: "destructive" });
      return;
    }
    if (form.scope !== "all" && !form.scope_value.trim()) {
      toast({ title: "Error", description: form.scope === "part" ? "Please select a part" : "Please enter a value for the selected scope", variant: "destructive" });
      return;
    }

    setSaving(true);

    const record = {
      type: form.type,
      scope: form.scope,
      scope_value: form.scope === "all" ? null : form.scope_value.trim(),
      amount,
      amount_type: form.amount_type,
      updated_at: new Date().toISOString(),
    };

    if (editingRule) {
      const { error } = await supabase
        .from("price_rules")
        .update(record)
        .eq("id", editingRule.id);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Rule updated" });
        setRules((prev) =>
          prev.map((r) => (r.id === editingRule.id ? { ...r, ...record } as PriceRule : r))
        );
      }
    } else {
      const { data, error } = await supabase
        .from("price_rules")
        .insert({ ...record, is_active: true })
        .select()
        .single();

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else if (data) {
        toast({ title: "Rule created" });
        setRules((prev) => [data, ...prev]);
      }
    }

    setSaving(false);
    setDialogOpen(false);
  };

  const toggleActive = async (rule: PriceRule) => {
    const newActive = !rule.is_active;
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, is_active: newActive } : r))
    );
    const { error } = await supabase
      .from("price_rules")
      .update({ is_active: newActive, updated_at: new Date().toISOString() })
      .eq("id", rule.id);

    if (error) {
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, is_active: rule.is_active } : r))
      );
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deleteRule = async (rule: PriceRule) => {
    const snapshot = rules;
    setRules((prev) => prev.filter((r) => r.id !== rule.id));

    const { error } = await supabase
      .from("price_rules")
      .delete()
      .eq("id", rule.id);

    if (error) {
      setRules(snapshot);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rule deleted" });
    }
  };

  const [partNames, setPartNames] = useState<Record<string, string>>({});

  // Load part names for rules with scope=part
  useEffect(() => {
    const partRules = rules.filter((r) => r.scope === "part" && r.scope_value && !partNames[r.scope_value]);
    if (partRules.length === 0) return;
    const ids = partRules.map((r) => r.scope_value!);
    supabase
      .from("parts")
      .select("id, name")
      .in("id", ids)
      .then(({ data }: { data: { id: string; name: string }[] | null }) => {
        if (data) {
          const names: Record<string, string> = {};
          data.forEach((p) => { names[p.id] = p.name; });
          setPartNames((prev) => ({ ...prev, ...names }));
        }
      });
  }, [rules, partNames]);

  const scopeLabel = (scope: string, value: string | null) => {
    switch (scope) {
      case "all": return "All Parts";
      case "make": return value || "—";
      case "model": return value || "—";
      case "vin": return value || "—";
      case "part": return value ? (partNames[value] || value.slice(0, 8) + "...") : "—";
      default: return "—";
    }
  };

  const activeCount = rules.filter((r) => r.is_active).length;
  const discountCount = rules.filter((r) => r.type === "discount").length;
  const markupCount = rules.filter((r) => r.type === "markup").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pricing Rules</h1>
          <p className="text-muted-foreground text-sm">
            Manage discounts and markups for your inventory
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tag className="h-4 w-4" /> Total Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold">{rules.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ToggleRight className="h-4 w-4 text-green-600" /> Active
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" /> Discounts
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold text-red-600">{discountCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" /> Markups
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold text-blue-600">{markupCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rules Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Percent className="h-10 w-10 mb-3" />
              <p className="text-sm">No pricing rules yet</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Create first rule
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id} className={!rule.is_active ? "opacity-50" : ""}>
                    <TableCell>
                      {rule.type === "discount" ? (
                        <Badge variant="destructive" className="text-xs">
                          <TrendingDown className="h-3 w-3 mr-1" /> Discount
                        </Badge>
                      ) : (
                        <Badge className="text-xs bg-blue-600">
                          <TrendingUp className="h-3 w-3 mr-1" /> Markup
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {rule.scope}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {scopeLabel(rule.scope, rule.scope_value)}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {rule.amount_type === "percent" ? (
                          <>{rule.amount}%</>
                        ) : (
                          <>${rule.amount}</>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => toggleActive(rule)}
                        className="flex items-center gap-1 text-xs"
                      >
                        {rule.is_active ? (
                          <ToggleRight className="h-5 w-5 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(rule)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteRule(rule)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Rule" : "Create Pricing Rule"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Type */}
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as "discount" | "markup" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discount">
                    <span className="flex items-center gap-2">
                      <TrendingDown className="h-3.5 w-3.5 text-red-600" /> Discount (price goes down)
                    </span>
                  </SelectItem>
                  <SelectItem value="markup">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-blue-600" /> Markup (price goes up)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Scope */}
            <div className="space-y-2">
              <Label>Apply to</Label>
              <Select
                value={form.scope}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    scope: v as "all" | "make" | "model" | "vin" | "part",
                    scope_value: v === "all" ? "" : v === "part" ? "" : f.scope_value,
                    part_name: v === "part" ? "" : f.part_name,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Parts</SelectItem>
                  <SelectItem value="part">Specific Part</SelectItem>
                  <SelectItem value="make">Specific Brand (Make)</SelectItem>
                  <SelectItem value="model">Specific Model</SelectItem>
                  <SelectItem value="vin">Specific VIN</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Scope Value */}
            {form.scope !== "all" && form.scope !== "part" && (
              <div className="space-y-2">
                <Label>
                  {form.scope === "make" ? "Brand Name" : form.scope === "model" ? "Model Name" : "VIN Number"}
                </Label>
                <Input
                  value={form.scope_value}
                  onChange={(e) => setForm((f) => ({ ...f, scope_value: e.target.value }))}
                  placeholder={
                    form.scope === "make"
                      ? "e.g., BMW, Jaguar, Infiniti"
                      : form.scope === "model"
                      ? "e.g., QX80, XF, Escalade"
                      : "e.g., 5UXZV4C58D0..."
                  }
                />
              </div>
            )}

            {/* Part Search */}
            {form.scope === "part" && (
              <div className="space-y-2">
                <Label>Search Part</Label>
                {form.part_name ? (
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                    <span className="text-sm font-medium flex-1 truncate">{form.part_name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        setForm((f) => ({ ...f, scope_value: "", part_name: "" }));
                        setPartSearch("");
                        setPartResults([]);
                      }}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={partSearch}
                        onChange={(e) => {
                          setPartSearch(e.target.value);
                          searchParts(e.target.value);
                        }}
                        placeholder="Type part name or stock #..."
                        className="pl-9"
                      />
                      {searchingParts && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {partResults.length > 0 && (
                      <div className="border rounded-md max-h-48 overflow-y-auto">
                        {partResults.map((p) => (
                          <button
                            key={p.id}
                            className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-b-0 transition-colors"
                            onClick={() => {
                              setForm((f) => ({ ...f, scope_value: p.id, part_name: p.name }));
                              setPartSearch("");
                              setPartResults([]);
                            }}
                          >
                            <div className="font-medium truncate">{p.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {[p.year, p.make, p.model].filter(Boolean).join(" ")}
                              {p.stock_number ? ` · #${p.stock_number}` : ""}
                              {` · $${p.price}`}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="10"
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {form.amount_type === "percent" ? "%" : "$"}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Amount Type</Label>
                <Select
                  value={form.amount_type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, amount_type: v as "percent" | "fixed" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">
                      <span className="flex items-center gap-1.5">
                        <Percent className="h-3.5 w-3.5" /> Percentage
                      </span>
                    </SelectItem>
                    <SelectItem value="fixed">
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5" /> Fixed ($)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRule ? "Save Changes" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
