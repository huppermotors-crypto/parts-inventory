import { StorefrontClient } from "@/components/storefront/storefront-client";

const BASE_URL = "https://parts-inventory.onrender.com";

const localeMeta: Record<string, { ogLocale: string }> = {
  en: { ogLocale: "en_US" },
  ru: { ogLocale: "ru_RU" },
  es: { ogLocale: "es_ES" },
};

export default async function StorefrontPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const meta = localeMeta[locale] || localeMeta.en;

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "HuppeR Auto Parts",
    url: `${BASE_URL}/${locale}`,
    inLanguage: meta.ogLocale.replace("_", "-"),
    potentialAction: {
      "@type": "SearchAction",
      target: `${BASE_URL}/${locale}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoPartsStore",
    name: "HuppeR Auto Parts",
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    email: "hupper.motors@gmail.com",
    description: "Quality used auto parts at great prices.",
    currenciesAccepted: "USD",
    paymentAccepted: "Cash, Credit Card, PayPal, Zelle, Venmo",
    priceRange: "$$",
    image: `${BASE_URL}/logo.png`,
    sameAs: [],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <StorefrontClient />
    </>
  );
}
