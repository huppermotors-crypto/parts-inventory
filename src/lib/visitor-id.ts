const COOKIE_NAME = "_hpr_vid";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

export function getVisitorId(): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  if (match) return match[1];

  const id = crypto.randomUUID();
  document.cookie = `${COOKIE_NAME}=${id}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  return id;
}
