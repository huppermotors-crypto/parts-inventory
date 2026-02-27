import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy' });
  return {
    title: t('title'),
    description: t('metaDescription'),
  };
}

export default async function PrivacyPolicyPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy' });
  const tFooter = await getTranslations({ locale, namespace: 'footer' });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image src="/icon.png" alt="" width={32} height={32} className="h-8 w-8" />
            <span className="text-lg font-bold">HuppeR Auto Parts</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl flex-1">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToStore')}
        </Link>

        <h1 className="text-3xl font-bold tracking-tight mb-2">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mb-8">{t('lastUpdated')}</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">{t('s1title')}</h2>
            <p className="leading-relaxed">{t('s1body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">{t('s2title')}</h2>
            <p className="leading-relaxed mb-3">{t('s2intro')}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li dangerouslySetInnerHTML={{ __html: t('s2pageViews') }} />
              <li dangerouslySetInnerHTML={{ __html: t('s2ip') }} />
              <li dangerouslySetInnerHTML={{ __html: t('s2device') }} />
              <li dangerouslySetInnerHTML={{ __html: t('s2location') }} />
              <li dangerouslySetInnerHTML={{ __html: t('s2referrer') }} />
              <li dangerouslySetInnerHTML={{ __html: t('s2visitor') }} />
            </ul>
            <p className="leading-relaxed mt-3" dangerouslySetInnerHTML={{ __html: t('s2notCollect') }} />
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">{t('s3title')}</h2>
            <p className="leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: t('s3intro') }} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-semibold">{t('s3cookie')}</th>
                    <th className="text-left py-2 pr-4 font-semibold">{t('s3purpose')}</th>
                    <th className="text-left py-2 font-semibold">{t('s3duration')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">{t('s3cookieName')}</td>
                    <td className="py-2 pr-4">{t('s3cookieDesc')}</td>
                    <td className="py-2 whitespace-nowrap">{t('s3cookieDuration')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="leading-relaxed mt-3">{t('s3noThirdParty')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">{t('s4title')}</h2>
            <p className="leading-relaxed">{t('s4body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">{t('s5title')}</h2>
            <p className="leading-relaxed">{t('s5body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">{t('s6title')}</h2>
            <div className="bg-muted border rounded-lg p-4 my-3">
              <p className="leading-relaxed font-semibold">{t('s6disclaimer')}</p>
            </div>
            <p className="leading-relaxed mb-3">{t('s6intro')}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li dangerouslySetInnerHTML={{ __html: t('s6asIs') }} />
              <li dangerouslySetInnerHTML={{ __html: t('s6noReturns') }} />
              <li>{t('s6buyerResponsibility')}</li>
              <li>{t('s6noLiability')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">{t('s7title')}</h2>
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 my-3">
              <p className="leading-relaxed font-medium text-destructive">{t('s7warning')}</p>
            </div>
            <ul className="list-disc pl-6 space-y-2">
              <li dangerouslySetInnerHTML={{ __html: t('s7certified') }} />
              <li dangerouslySetInnerHTML={{ __html: t('s7noGuarantee') }} />
              <li>{t('s7buyerRisk')}</li>
              <li dangerouslySetInnerHTML={{
                __html: t('s7recall').replace(
                  '<link>nhtsa.gov/recalls</link>',
                  '<a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noopener noreferrer" class="underline font-medium">nhtsa.gov/recalls</a>'
                )
              }} />
              <li>{t('s7regulated')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">{t('s8title')}</h2>
            <p className="leading-relaxed">{t('s8body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">{t('s9title')}</h2>
            <p className="leading-relaxed">{t('s9body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">{t('s10title')}</h2>
            <p className="leading-relaxed">{t('s10body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">{t('s11title')}</h2>
            <p className="leading-relaxed">{t('s11intro')}</p>
            <ul className="list-none pl-0 mt-3 space-y-1">
              <li>
                <strong>{t('s11business')}</strong> HuppeR Auto Parts
              </li>
              <li>
                <strong>{t('s11email')}</strong>{" "}
                <a href="mailto:hupper.motors@gmail.com" className="underline font-medium">
                  hupper.motors@gmail.com
                </a>
              </li>
            </ul>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>{tFooter('copyright', { year: new Date().getFullYear() })}</p>
        </div>
      </footer>
    </div>
  );
}
