import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/parts/", "/shipping", "/privacy"],
        disallow: ["/admin/", "/api/", "/login"],
      },
    ],
    sitemap: "https://parts-inventory.onrender.com/sitemap.xml",
  };
}
