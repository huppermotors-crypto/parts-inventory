"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Search,
  MessageCircle,
  User,
  Bot,
  Headset,
  ArrowLeft,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface ChatSession {
  id: string;
  visitor_id: string;
  status: "active" | "escalated" | "closed";
  part_context: {
    name?: string;
    price?: number;
    make?: string;
    model?: string;
    year?: number;
    condition?: string;
    category?: string;
    stock_number?: string;
    description?: string;
  } | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message: {
    content: string;
    role: string;
    created_at: string;
  } | null;
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant" | "operator";
  content: string;
  created_at: string;
}

type StatusFilter = "all" | "active" | "escalated" | "closed";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  escalated: "bg-amber-100 text-amber-800",
  closed: "bg-gray-100 text-gray-600",
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ChatsPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Mobile: show messages panel when session selected
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/chats?${params}`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const selectSession = async (session: ChatSession) => {
    setSelectedId(session.id);
    setSelectedSession(session);
    setMobileView("chat");
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/admin/chats/${session.id}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const statusCounts = {
    all: sessions.length,
    active: sessions.filter((s) => s.status === "active").length,
    escalated: sessions.filter((s) => s.status === "escalated").length,
    closed: sessions.filter((s) => s.status === "closed").length,
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Chat History</h1>
        <p className="text-muted-foreground text-sm">
          Review conversations with buyers
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <TabsList>
            <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
            <TabsTrigger value="active">Active ({statusCounts.active})</TabsTrigger>
            <TabsTrigger value="escalated">Escalated ({statusCounts.escalated})</TabsTrigger>
            <TabsTrigger value="closed">Closed ({statusCounts.closed})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No chats found</h3>
            <p className="text-muted-foreground mt-1">
              Chat sessions will appear here when buyers use the chat widget.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 min-h-[600px]">
          {/* Session List */}
          <Card
            className={`overflow-hidden ${
              mobileView === "chat" ? "hidden lg:block" : ""
            }`}
          >
            <div className="divide-y max-h-[calc(100vh-240px)] overflow-y-auto">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => selectSession(session)}
                  className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${
                    selectedId === session.id ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {session.part_context?.name || "No part context"}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 shrink-0 ${
                            STATUS_COLORS[session.status] || ""
                          }`}
                        >
                          {session.status}
                        </Badge>
                      </div>
                      {session.part_context?.price && (
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(session.part_context.price)}
                          {session.part_context.make &&
                            ` · ${[session.part_context.year, session.part_context.make, session.part_context.model].filter(Boolean).join(" ")}`}
                        </p>
                      )}
                      {session.last_message && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          <span className="font-medium">
                            {session.last_message.role === "user"
                              ? "Buyer"
                              : session.last_message.role === "operator"
                                ? "You"
                                : "Bot"}
                            :
                          </span>{" "}
                          {session.last_message.content.slice(0, 80)}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground">
                        {timeAgo(session.updated_at)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {session.message_count} msgs
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Messages Panel */}
          <Card
            className={`overflow-hidden flex flex-col ${
              mobileView === "list" ? "hidden lg:flex" : "flex"
            }`}
          >
            {!selectedId ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select a chat to view messages</p>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="border-b px-4 py-3 flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden h-8 w-8"
                    onClick={() => setMobileView("list")}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {selectedSession?.part_context?.name || "Chat"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedSession?.part_context?.price &&
                        formatPrice(selectedSession.part_context.price)}
                      {selectedSession?.part_context?.make &&
                        ` · ${[selectedSession.part_context.year, selectedSession.part_context.make, selectedSession.part_context.model].filter(Boolean).join(" ")}`}
                      {" · "}
                      Visitor: {selectedSession?.visitor_id?.slice(0, 8)}...
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={STATUS_COLORS[selectedSession?.status || "closed"]}
                  >
                    {selectedSession?.status}
                  </Badge>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[calc(100vh-320px)]">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-10">
                      No messages
                    </p>
                  ) : (
                    <>
                      <p className="text-center text-xs text-muted-foreground">
                        {formatDate(messages[0].created_at)}
                      </p>
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-2 ${
                            msg.role === "user" ? "justify-end" : "justify-start"
                          }`}
                        >
                          {msg.role !== "user" && (
                            <div
                              className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-white ${
                                msg.role === "operator"
                                  ? "bg-green-600"
                                  : "bg-gray-400"
                              }`}
                            >
                              {msg.role === "operator" ? (
                                <Headset className="h-3.5 w-3.5" />
                              ) : (
                                <Bot className="h-3.5 w-3.5" />
                              )}
                            </div>
                          )}
                          <div
                            className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                              msg.role === "user"
                                ? "bg-blue-600 text-white"
                                : msg.role === "operator"
                                  ? "bg-green-100 text-green-900"
                                  : "bg-muted"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">
                              {msg.content}
                            </p>
                            <p
                              className={`text-[10px] mt-1 ${
                                msg.role === "user"
                                  ? "text-blue-200"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {formatTime(msg.created_at)}
                            </p>
                          </div>
                          {msg.role === "user" && (
                            <div className="shrink-0 h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-white">
                              <User className="h-3.5 w-3.5" />
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Session info footer */}
                {selectedSession && (
                  <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
                    <span>
                      Started: {formatDate(selectedSession.created_at)}
                    </span>
                    <span>{messages.length} messages</span>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
