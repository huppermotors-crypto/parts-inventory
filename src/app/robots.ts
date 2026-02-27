import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/en/", "/ru/", "/es/", "/en/parts/", "/ru/parts/", "/es/parts/",
                "/en/shipping", "/ru/shipping", "/es/shipping",
                "/en/privacy", "/ru/privacy", "/es/privacy"],
        disallow: ["/en/admin/", "/ru/admin/", "/es/admin/", "/api/",
                   "/en/login", "/ru/login", "/es/login"],
      },
    ],
    sitemap: "https://parts-inventory.onrender.com/sitemap.xml",
  };
}
