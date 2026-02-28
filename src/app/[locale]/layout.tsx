import { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Toaster } from "@/components/ui/toaster";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { ChatWidget } from "@/components/chat/chat-widget";

const BASE_URL = "https://parts-inventory.onrender.com";

const localeMeta: Record<string, { title: string; description: string; ogLocale: string }> = {
  en: {
    title: "HuppeR Auto Parts - Quality Used Auto Parts",
    description: "Browse quality used auto parts. Find engines, transmissions, body panels, and more at great prices.",
    ogLocale: "en_US",
  },
  ru: {
    title: "HuppeR Auto Parts - Качественные б/у автозапчасти",
    description: "Автозапчасти б/у в отличном состоянии: двигатели, КПП, кузовные детали и многое другое по выгодным ценам.",
    ogLocale: "ru_RU",
  },
  es: {
    title: "HuppeR Auto Parts - Repuestos de Auto Usados de Calidad",
    description: "Explore repuestos de auto usados de calidad. Encuentre motores, transmisiones, paneles de carrocería y más a excelentes precios.",
    ogLocale: "es_ES",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const meta = localeMeta[locale] || localeMeta.en;

  const alternates: Record<string, string> = {};
  for (const loc of routing.locales) {
    alternates[loc] = `${BASE_URL}/${loc}`;
  }

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `${BASE_URL}/${locale}`,
      languages: alternates,
    },
    openGraph: {
      locale: meta.ogLocale,
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => localeMeta[l]?.ogLocale || l),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
      <PageViewTracker />
      <ChatWidget />
      <Toaster />
    </NextIntlClientProvider>
  );
}
