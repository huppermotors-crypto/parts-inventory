"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  Download,
  Loader2,
  User,
  Globe,
  Camera,
  Bell,
  Database,
  Settings as SettingsIcon,
  FileJson,
  FileSpreadsheet,
  BarChart3,
  Eye,
  EyeOff,
  ImageIcon,
  Upload,
  Trash2,
  Puzzle,
  History,
  AlertTriangle,
} from "lucide-react";
import Image from "next/image";

const supabase = createClient();

interface SiteSettings {
  store_name: string;
  contact_email: string;
  contact_phone: string;
  max_photos: number;
  compression_max_kb: number;
  watermark_enabled: boolean;
  watermark_text: string;
  email_notifications: boolean;
  sound_notifications: boolean;
}

const DEFAULT_SETTINGS: SiteSettings = {
  store_name: "HuppeR Auto Parts",
  contact_email: "hupper.motors@gmail.com",
  contact_phone: "",
  max_photos: 10,
  compression_max_kb: 300,
  watermark_enabled: false,
  watermark_text: "HuppeR Auto Parts",
  email_notifications: false,
  sound_notifications: true,
};

export default function SettingsPage() {
  const t = useTranslations("admin.settings");
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState("");
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState<string | null>(null);

  // Favicon
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Activity Log
  interface LogEntry {
    id: string;
    action: string;
    details: string | null;
    part_id: string | null;
    created_at: string;
  }
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState(false);
  const [logLoaded, setLogLoaded] = useState(false);

  const ACTION_LABELS: Record<string, string> = {
    part_created: "Part created",
    part_updated: "Part updated",
    part_deleted: "Part deleted",
    part_sold: "Part sold",
    part_unsold: "Part returned to sale",
    part_partial_sold: "Partial sale",
    bulk_sold: "Bulk marked sold",
    bulk_available: "Bulk marked available",
    bulk_deleted: "Bulk deleted",
    bulk_price_update: "Bulk price update",
    lot_merged: "Lot merged",
    fb_posted: "Posted to FB",
    fb_delisted: "Removed from FB",
    ebay_posted: "Posted to eBay",
    ebay_delisted: "Removed from eBay",
    settings_updated: "Settings updated",
  };

  const [logSize, setLogSize] = useState<{ size_bytes: number; row_count: number } | null>(null);
  const [archiveInfo, setArchiveInfo] = useState<{ size_bytes: number; row_count: number; oldest: string | null; newest: string | null } | null>(null);
  const [rotating, setRotating] = useState(false);

  const loadLog = useCallback(async () => {
    if (logLoaded) return;
    setLogLoading(true);
    setLogError(false);
    try {
      const [logResult, sizeResult, archiveResult] = await Promise.all([
        supabase
          .from("activity_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.rpc("get_activity_log_size"),
        supabase.rpc("get_activity_log_archives"),
      ]);
      if (logResult.error) throw logResult.error;
      setLogEntries(logResult.data || []);
      if (sizeResult.data) setLogSize(sizeResult.data as { size_bytes: number; row_count: number });
      if (archiveResult.data) setArchiveInfo(archiveResult.data as { size_bytes: number; row_count: number; oldest: string | null; newest: string | null });
      setLogLoaded(true);
    } catch {
      setLogError(true);
    } finally {
      setLogLoading(false);
    }
  }, [logLoaded]);

  const handleRotateLog = async () => {
    if (!confirm("Archive old log entries? Only the last 1000 entries will remain in the active log.")) return;
    setRotating(true);
    try {
      await supabase.rpc("rotate_activity_log");
      setLogLoaded(false);
      await loadLog();
    } catch {
      toast({ title: "Error", description: "Failed to rotate log", variant: "destructive" });
    } finally {
      setRotating(false);
    }
  };

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  const loadSettings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserEmail(user.email || "");

      const { data } = await supabase
        .from("site_settings")
        .select("key, value");

      if (data && data.length > 0) {
        const loaded = { ...DEFAULT_SETTINGS };
        for (const row of data) {
          if (row.key === "favicon_url") {
            setFaviconUrl(row.value || null);
            continue;
          }
          const key = row.key as keyof SiteSettings;
          if (key in loaded) {
            const val = row.value;
            if (typeof loaded[key] === "number") {
              (loaded as Record<string, unknown>)[key] = Number(val);
            } else if (typeof loaded[key] === "boolean") {
              (loaded as Record<string, unknown>)[key] = val === "true";
            } else {
              (loaded as Record<string, unknown>)[key] = val;
            }
          }
        }
        setSettings(loaded);
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(settings).map(([key, value]) => ({
        key,
        value: String(value),
      }));

      for (const entry of entries) {
        await supabase
          .from("site_settings")
          .upsert(entry, { onConflict: "key" });
      }

      toast({ title: t("settingsSaved") });
    } catch {
      toast({ title: t("settingsFailed"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFavicon(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const filePath = `site-assets/favicon.${ext}`;

      // Remove old file if exists
      await supabase.storage.from("part-photos").remove([filePath]);

      const { error: uploadError } = await supabase.storage
        .from("part-photos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("part-photos")
        .getPublicUrl(filePath);

      // Save URL to site_settings
      await supabase
        .from("site_settings")
        .upsert({ key: "favicon_url", value: publicUrl }, { onConflict: "key" });

      setFaviconUrl(publicUrl);
      toast({ title: t("faviconUploaded") });
    } catch {
      toast({ title: t("faviconFailed"), variant: "destructive" });
    } finally {
      setUploadingFavicon(false);
      e.target.value = "";
    }
  };

  const handleFaviconRemove = async () => {
    try {
      await supabase.storage.from("part-photos").remove(["site-assets/favicon.png", "site-assets/favicon.ico"]);
      await supabase.from("site_settings").delete().eq("key", "favicon_url");
      setFaviconUrl(null);
      toast({ title: t("faviconRemoved") });
    } catch {
      toast({ title: t("faviconFailed"), variant: "destructive" });
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: t("passwordTooShort"), variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: t("passwordMismatch"), variant: "destructive" });
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: t("passwordUpdated") });
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast({ title: t("passwordFailed"), variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  };

  const downloadFile = (data: string, filename: string, type: string) => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toCsv = (rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const val = row[h];
            const str = val === null || val === undefined ? "" : String(val);
            return str.includes(",") || str.includes('"') || str.includes("\n")
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(",")
      ),
    ];
    return lines.join("\n");
  };

  const handleFullBackup = async () => {
    setDownloadingBackup("full");
    try {
      const fetchAll = async (table: string) => {
        const { data } = await supabase.from(table).select("*");
        return data || [];
      };
      const fetchPageViews = async () => {
        const { data } = await supabase.from("page_views").select("*").order("created_at", { ascending: false }).limit(50000);
        return data || [];
      };

      const [parts, vehicles, priceRules, pageViews, chatSessions, chatMessages] = await Promise.all([
        fetchAll("parts"),
        fetchAll("vehicles"),
        fetchAll("price_rules"),
        fetchPageViews(),
        fetchAll("chat_sessions"),
        fetchAll("chat_messages"),
      ]);

      const backup = {
        exported_at: new Date().toISOString(),
        tables: {
          parts: { count: parts.length, data: parts },
          vehicles: { count: vehicles.length, data: vehicles },
          price_rules: { count: priceRules.length, data: priceRules },
          page_views: { count: pageViews.length, data: pageViews },
          chat_sessions: { count: chatSessions.length, data: chatSessions },
          chat_messages: { count: chatMessages.length, data: chatMessages },
        },
      };

      const date = new Date().toISOString().slice(0, 10);
      downloadFile(JSON.stringify(backup, null, 2), `backup-full-${date}.json`, "application/json");
      toast({ title: t("backupSuccess") });
    } catch {
      toast({ title: t("backupFailed"), variant: "destructive" });
    } finally {
      setDownloadingBackup(null);
    }
  };

  const handleExportPartsCsv = async () => {
    setDownloadingBackup("parts-csv");
    try {
      const { data } = await supabase.from("parts").select("*");
      if (!data || data.length === 0) return;

      const rows = data.map((p: Record<string, unknown>) => ({
        ...p,
        photos: Array.isArray(p.photos) ? (p.photos as string[]).join("; ") : p.photos,
      }));

      const date = new Date().toISOString().slice(0, 10);
      downloadFile(toCsv(rows), `parts-${date}.csv`, "text/csv");
      toast({ title: t("backupSuccess") });
    } catch {
      toast({ title: t("backupFailed"), variant: "destructive" });
    } finally {
      setDownloadingBackup(null);
    }
  };

  const handleExportPartsJson = async () => {
    setDownloadingBackup("parts-json");
    try {
      const { data } = await supabase.from("parts").select("*");
      const date = new Date().toISOString().slice(0, 10);
      downloadFile(JSON.stringify(data || [], null, 2), `parts-${date}.json`, "application/json");
      toast({ title: t("backupSuccess") });
    } catch {
      toast({ title: t("backupFailed"), variant: "destructive" });
    } finally {
      setDownloadingBackup(null);
    }
  };

  const handleExportAnalytics = async () => {
    setDownloadingBackup("analytics");
    try {
      const { data } = await supabase
        .from("page_views")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50000);

      if (!data || data.length === 0) return;
      const date = new Date().toISOString().slice(0, 10);
      downloadFile(toCsv(data), `analytics-${date}.csv`, "text/csv");
      toast({ title: t("backupSuccess") });
    } catch {
      toast({ title: t("backupFailed"), variant: "destructive" });
    } finally {
      setDownloadingBackup(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6" onValueChange={(v) => { if (v === "changelog") loadLog(); }}>
        <TabsList className="w-full flex overflow-x-auto">
          <TabsTrigger value="general" className="flex-1 gap-1.5">
            <SettingsIcon className="h-4 w-4 hidden sm:inline" />
            {t("tabGeneral")}
          </TabsTrigger>
          <TabsTrigger value="account" className="flex-1 gap-1.5">
            <User className="h-4 w-4 hidden sm:inline" />
            {t("tabAccount")}
          </TabsTrigger>
          <TabsTrigger value="photos" className="flex-1 gap-1.5">
            <Camera className="h-4 w-4 hidden sm:inline" />
            {t("tabPhotos")}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex-1 gap-1.5">
            <Bell className="h-4 w-4 hidden sm:inline" />
            {t("tabNotifications")}
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex-1 gap-1.5">
            <Database className="h-4 w-4 hidden sm:inline" />
            {t("tabTools")}
          </TabsTrigger>
          <TabsTrigger value="changelog" className="flex-1 gap-1.5">
            <History className="h-4 w-4 hidden sm:inline" />
            {t("tabChangelog")}
          </TabsTrigger>
        </TabsList>

        {/* ── General ── */}
        <TabsContent value="general" className="space-y-6">
          {/* Site Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                {t("siteSettings")}
              </CardTitle>
              <CardDescription>{t("siteSettingsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-w-sm">
                <Label>{t("storeName")}</Label>
                <Input
                  value={settings.store_name}
                  onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
                />
              </div>
              <div className="space-y-2 max-w-sm">
                <Label>{t("contactEmail")}</Label>
                <Input
                  type="email"
                  value={settings.contact_email}
                  onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                />
              </div>
              <div className="space-y-2 max-w-sm">
                <Label>{t("contactPhone")}</Label>
                <Input
                  type="tel"
                  placeholder={t("phonePlaceholder")}
                  value={settings.contact_phone}
                  onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Favicon */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                {t("favicon")}
              </CardTitle>
              <CardDescription>{t("faviconDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                  {faviconUrl ? (
                    <Image
                      src={faviconUrl}
                      alt="Favicon"
                      width={64}
                      height={64}
                      className="object-contain"
                      unoptimized
                    />
                  ) : (
                    <Image
                      src="/icon.png"
                      alt="Default favicon"
                      width={64}
                      height={64}
                      className="object-contain"
                      unoptimized
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {t("faviconCurrent")}: {faviconUrl ? "Custom" : t("faviconDefault")}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("faviconHint")}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={uploadingFavicon}
                  onClick={() => document.getElementById("favicon-input")?.click()}
                >
                  {uploadingFavicon ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {t("faviconUpload")}
                </Button>
                {faviconUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-destructive"
                    onClick={handleFaviconRemove}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("faviconRemove")}
                  </Button>
                )}
                <input
                  id="favicon-input"
                  type="file"
                  accept="image/png,image/x-icon,image/svg+xml"
                  className="hidden"
                  onChange={handleFaviconUpload}
                />
              </div>
            </CardContent>
          </Card>

          {/* Language */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {t("language")}
              </CardTitle>
              <CardDescription>{t("languageDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <LanguageSwitcher className="w-[200px] h-9 text-sm" />
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={saving} size="lg">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("saveSettings")}
            </Button>
          </div>
        </TabsContent>

        {/* ── Account ── */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t("profile")}
              </CardTitle>
              <CardDescription>{t("profileDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("currentEmail")}</Label>
                <Input value={userEmail} disabled className="max-w-sm bg-muted" />
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-base font-medium">{t("changePassword")}</Label>
                <div className="space-y-2 max-w-sm">
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      placeholder={t("newPassword")}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Input
                    type="password"
                    placeholder={t("confirmPassword")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <Button
                    onClick={handleChangePassword}
                    disabled={changingPassword || !newPassword}
                    size="sm"
                  >
                    {changingPassword && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {t("updatePassword")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Photos ── */}
        <TabsContent value="photos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                {t("photoSettings")}
              </CardTitle>
              <CardDescription>{t("photoSettingsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 max-w-sm">
                <div className="space-y-2">
                  <Label>{t("maxPhotos")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={settings.max_photos}
                    onChange={(e) => setSettings({ ...settings, max_photos: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("compressionQuality")}</Label>
                  <Input
                    type="number"
                    min={50}
                    max={2000}
                    step={50}
                    value={settings.compression_max_kb}
                    onChange={(e) => setSettings({ ...settings, compression_max_kb: Number(e.target.value) })}
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between max-w-sm">
                  <Label htmlFor="watermark-toggle">{t("watermarkEnabled")}</Label>
                  <Switch
                    id="watermark-toggle"
                    checked={settings.watermark_enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, watermark_enabled: checked })}
                  />
                </div>
                {settings.watermark_enabled && (
                  <div className="space-y-2 max-w-sm">
                    <Label>{t("watermarkText")}</Label>
                    <Input
                      value={settings.watermark_text}
                      onChange={(e) => setSettings({ ...settings, watermark_text: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={saving} size="lg">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("saveSettings")}
            </Button>
          </div>
        </TabsContent>

        {/* ── Notifications ── */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {t("notifications")}
              </CardTitle>
              <CardDescription>{t("notificationsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between max-w-sm">
                <Label htmlFor="email-notif">{t("emailNotifications")}</Label>
                <Switch
                  id="email-notif"
                  checked={settings.email_notifications}
                  onCheckedChange={(checked) => setSettings({ ...settings, email_notifications: checked })}
                />
              </div>
              <div className="flex items-center justify-between max-w-sm">
                <Label htmlFor="sound-notif">{t("soundNotifications")}</Label>
                <Switch
                  id="sound-notif"
                  checked={settings.sound_notifications}
                  onCheckedChange={(checked) => setSettings({ ...settings, sound_notifications: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={saving} size="lg">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("saveSettings")}
            </Button>
          </div>
        </TabsContent>

        {/* ── Backup & Tools ── */}
        <TabsContent value="tools" className="space-y-6">
          {/* Backup & Export */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                {t("backup")}
              </CardTitle>
              <CardDescription>{t("backupDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="justify-start gap-2 h-auto py-3"
                  onClick={handleFullBackup}
                  disabled={downloadingBackup !== null}
                >
                  {downloadingBackup === "full" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileJson className="h-4 w-4" />
                  )}
                  <div className="text-left">
                    <div className="font-medium">{t("fullBackup")}</div>
                    <div className="text-xs text-muted-foreground">{t("fullBackupDesc")}</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="justify-start gap-2 h-auto py-3"
                  onClick={handleExportPartsCsv}
                  disabled={downloadingBackup !== null}
                >
                  {downloadingBackup === "parts-csv" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}
                  <div className="text-left">
                    <div className="font-medium">{t("exportParts")}</div>
                    <div className="text-xs text-muted-foreground">{t("exportPartsDesc")}</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="justify-start gap-2 h-auto py-3"
                  onClick={handleExportPartsJson}
                  disabled={downloadingBackup !== null}
                >
                  {downloadingBackup === "parts-json" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileJson className="h-4 w-4" />
                  )}
                  <div className="text-left">
                    <div className="font-medium">{t("exportPartsJson")}</div>
                    <div className="text-xs text-muted-foreground">{t("exportPartsDesc")}</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="justify-start gap-2 h-auto py-3"
                  onClick={handleExportAnalytics}
                  disabled={downloadingBackup !== null}
                >
                  {downloadingBackup === "analytics" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BarChart3 className="h-4 w-4" />
                  )}
                  <div className="text-left">
                    <div className="font-medium">{t("exportAnalytics")}</div>
                    <div className="text-xs text-muted-foreground">{t("exportAnalyticsDesc")}</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Chrome Extension */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Puzzle className="h-5 w-5" />
                {t("chromeExtension")}
              </CardTitle>
              <CardDescription>{t("chromeExtensionDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href="/extension.zip"
                download="AutoParts-Extension-v1.1.3.zip"
              >
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  {t("downloadExtension")}
                </Button>
              </a>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Activity Log ── */}
        <TabsContent value="changelog" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    {t("changelog")}
                  </CardTitle>
                  <CardDescription className="mt-1">{t("changelogDesc")}</CardDescription>
                </div>
                {logSize && (
                  <div className="text-right text-sm shrink-0">
                    <p className="font-medium">{formatBytes(logSize.size_bytes)}</p>
                    <p className="text-xs text-muted-foreground">{logSize.row_count} records</p>
                  </div>
                )}
              </div>
              {logSize && logSize.size_bytes > 500 * 1024 * 1024 && (
                <div className="mt-3 flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Log size exceeds 500 MB. Consider clearing old entries.</span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {logLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {logError && (
                <p className="text-sm text-destructive">{t("changelogError")}</p>
              )}
              {logLoaded && logEntries.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("changelogEmpty")}</p>
              )}
              {logLoaded && logEntries.length > 0 && (
                <div className="space-y-1 max-h-[500px] overflow-y-auto">
                  {logEntries.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 py-2 border-b last:border-b-0">
                      <History className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">
                          {ACTION_LABELS[entry.action] || entry.action}
                        </p>
                        {entry.details && (
                          <p className="text-sm text-muted-foreground">{entry.details}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(entry.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {" "}
                          {new Date(entry.created_at).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {logLoaded && logEntries.length > 0 && (
                <div className="mt-4 pt-3 border-t flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {logSize ? `${logSize.row_count} total records · ${formatBytes(logSize.size_bytes)}` : ""}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRotateLog}
                    disabled={rotating}
                    className="gap-1.5 text-xs"
                  >
                    {rotating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
                    Archive old entries
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Archive info */}
          {archiveInfo && archiveInfo.row_count > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Archive
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Size: </span>
                    <span className="font-medium">{formatBytes(archiveInfo.size_bytes)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Records: </span>
                    <span className="font-medium">{archiveInfo.row_count}</span>
                  </div>
                  {archiveInfo.oldest && archiveInfo.newest && (
                    <div>
                      <span className="text-muted-foreground">Period: </span>
                      <span className="font-medium">
                        {new Date(archiveInfo.oldest).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {" — "}
                        {new Date(archiveInfo.newest).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
