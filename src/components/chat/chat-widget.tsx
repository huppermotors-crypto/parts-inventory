"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X, Send, User } from "lucide-react";
import { getVisitorId } from "@/lib/visitor-id";

interface ChatMessage {
  id?: number;
  role: "user" | "assistant" | "operator";
  content: string;
  created_at: string;
}

interface PartContext {
  name?: string;
  price?: number;
  make?: string;
  model?: string;
  year?: number | string;
  condition?: string;
  category?: string;
  stock_number?: string;
  description?: string;
}

export function ChatWidget() {
  const pathname = usePathname();
  const isPartPage = pathname.startsWith("/parts/");

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // End session — send log to Telegram when chat closes
  const endSession = useCallback(async () => {
    if (!sessionIdRef.current || messages.length === 0) return;
    try {
      await fetch("/api/chat/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      });
    } catch {
      // Silent
    }
    setSessionId(null);
    setMessages([]);
  }, [messages.length]);

  // Listen for "open-chat" event from part detail page
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("open-chat", handler);
    return () => window.removeEventListener("open-chat", handler);
  }, []);

  // Polling for new messages (operator replies only, never removes messages)
  const pollMessages = useCallback(async () => {
    if (!sessionIdRef.current || sendingRef.current) return;
    try {
      const res = await fetch(
        `/api/chat/messages?sessionId=${sessionIdRef.current}&after=`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        setMessages((prev) => {
          // Only update if server has MORE messages (e.g., operator reply came in)
          // Never replace with fewer — prevents race condition message loss
          if (data.messages.length <= prev.length) return prev;
          return data.messages;
        });
      }
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    if (isOpen && sessionId) {
      pollRef.current = setInterval(pollMessages, 4000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isOpen, sessionId, pollMessages]);

  // Only render on part detail pages
  if (!isPartPage) {
    return null;
  }

  const getPartContext = (): PartContext | null => {
    if (typeof document === "undefined") return null;
    const el = document.getElementById("part-data");
    if (!el) return null;
    try {
      const data = JSON.parse(el.getAttribute("data-part") || "");
      return {
        name: data.title,
        price: data.price,
        make: data.make,
        model: data.model,
        year: data.year,
        condition: data.condition,
        category: data.category,
        stock_number: data.serial_number,
        description: data.description,
      };
    } catch {
      return null;
    }
  };

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    sendingRef.current = true;

    const visitorId = getVisitorId();
    const partContext = getPartContext();

    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const readDelay = 1500 + Math.random() * 1500;
    await delay(readDelay);
    setSending(true);

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          visitorId,
          message: text,
          partContext,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errorMsg: ChatMessage = {
          role: "assistant",
          content: err.error || "Something went wrong. Please try again.",
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }

      const data = await res.json();

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      if (data.reply) {
        const replyLen = data.reply.content.length;
        const typingDelay = Math.min(4000, Math.max(1500, replyLen * 20));
        await delay(typingDelay);
        setMessages((prev) => [...prev, data.reply]);
      }
    } catch {
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: "Connection error. Please try again.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const roleAvatar = (role: string) => {
    if (role === "user") {
      return (
        <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <User className="h-4 w-4" />
        </div>
      );
    }
    return (
      <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
        JS
      </div>
    );
  };

  const roleBg = (role: string) => {
    if (role === "user") return "bg-blue-600 text-white ml-auto";
    if (role === "operator") return "bg-emerald-50 text-gray-900 border border-emerald-200";
    return "bg-gray-100 text-gray-900";
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex w-[360px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:w-[400px]"
          style={{ height: "min(500px, calc(100vh - 48px))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-blue-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                JS
              </div>
              <div>
                <span className="font-semibold text-sm">John S.</span>
                <p className="text-[10px] text-white/70 leading-none">HuppeR Motors Support</p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                if (sessionId && messages.length > 0) {
                  endSession();
                }
              }}
              className="rounded-full p-1 hover:bg-blue-700 focus:outline-none"
              aria-label="Close chat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white text-lg font-bold mb-3">
                  JS
                </div>
                <p className="text-sm font-medium text-gray-700">Hey! I&apos;m John</p>
                <p className="text-xs mt-1 text-gray-400">
                  Ask me about parts, compatibility, pricing...
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={msg.id || `msg-${i}`}
                className={`flex items-start gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {roleAvatar(msg.role)}
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${roleBg(msg.role)}`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-start gap-2">
                <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
                  JS
                </div>
                <div className="rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-500">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 px-3 py-2">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                disabled={sending}
                className="flex-1 rounded-full border border-gray-300 bg-gray-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                maxLength={2000}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                size="icon"
                className="h-9 w-9 rounded-full"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
