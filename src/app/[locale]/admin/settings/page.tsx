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
  GitCommit,
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

  // Changelog
  interface Commit {
    sha: string;
    message: string;
    date: string;
    author: string;
  }
  const [commits, setCommits] = useState<Commit[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [commitsError, setCommitsError] = useState(false);
  const [commitsLoaded, setCommitsLoaded] = useState(false);

  const loadCommits = useCallback(async () => {
    if (commitsLoaded) return;
    setCommitsLoading(true);
    setCommitsError(false);
    try {
      const res = await fetch(
        "https://api.github.com/repos/huppermotors-crypto/parts-inventory/commits?per_page=50"
      );
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setCommits(
        data.map((c: { sha: string; commit: { message: string; author: { name: string; date: string } } }) => ({
          sha: c.sha,
          message: c.commit.message,
          date: c.commit.author.date,
          author: c.commit.author.name,
        }))
      );
      setCommitsLoaded(true);
    } catch {
      setCommitsError(true);
    } finally {
      setCommitsLoading(false);
    }
  }, [commitsLoaded]);

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

      <Tabs defaultValue="general" className="space-y-6">
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

        {/* ── Changelog ── */}
        <TabsContent value="changelog" className="space-y-6" onFocus={loadCommits}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                {t("changelog")}
              </CardTitle>
              <CardDescription>{t("changelogDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {!commitsLoaded && !commitsLoading && !commitsError && (
                <Button variant="outline" onClick={loadCommits} className="gap-2">
                  <History className="h-4 w-4" />
                  {t("changelog")}
                </Button>
              )}
              {commitsLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {commitsError && (
                <p className="text-sm text-destructive">{t("changelogError")}</p>
              )}
              {commitsLoaded && commits.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("changelogEmpty")}</p>
              )}
              {commitsLoaded && commits.length > 0 && (
                <div className="space-y-1">
                  {commits.map((c) => (
                    <div key={c.sha} className="flex items-start gap-3 py-2 border-b last:border-b-0">
                      <GitCommit className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{c.message.split("\n")[0]}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <span className="font-mono">{c.sha.slice(0, 7)}</span>
                          {" · "}
                          {new Date(c.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {" · "}
                          {c.author}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
