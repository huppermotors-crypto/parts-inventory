"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const COOKIE_NAME = "_hpr_vid";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

function getVisitorId(): string {
  // Try to read existing cookie
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  if (match) return match[1];

  // Generate new UUID
  const id = crypto.randomUUID();
  document.cookie = `${COOKIE_NAME}=${id}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  return id;
}

export function PageViewTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;

    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/api")
    ) {
      return;
    }

    const visitorId = getVisitorId();

    const payload = JSON.stringify({
      path: pathname,
      title: document.title,
      referrer: document.referrer,
      visitor_id: visitorId,
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/track", blob);
    } else {
      fetch("/api/analytics/track", {
        method: "POST",
        body: payload,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {});
    }
  }, [pathname]);

  return null;
}
