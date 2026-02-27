import { Metadata } from "next";
import { Truck, Package, DollarSign, MapPin, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shipping' });
  return {
    title: t('title'),
    description: t('metaDescription'),
  };
}

export default async function ShippingPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shipping' });

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
      <p className="text-muted-foreground mb-8">
        {t('lastUpdated', { date: new Date().toLocaleDateString(locale === 'ru' ? 'ru-RU' : locale === 'es' ? 'es-ES' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) })}
      </p>

      {/* Shipping */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Truck className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">{t('shippingPolicy')}</h2>
        </div>

        <div className="space-y-4 text-sm leading-relaxed">
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Package className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
              <div>
                <p className="font-medium text-green-700">{t('smallPartsTitle')}</p>
                <p className="text-muted-foreground mt-1">{t('smallPartsBody')}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
              <div>
                <p className="font-medium text-red-700">{t('largePartsTitle')}</p>
                <p className="text-muted-foreground mt-1" dangerouslySetInnerHTML={{ __html: t('largePartsBody') }} />
              </div>
            </div>
          </div>

          <p dangerouslySetInnerHTML={{ __html: t('shippingArranged') }} />

          <p className="text-muted-foreground">{t('noLiability')}</p>
        </div>
      </section>

      <hr className="my-8" />

      {/* Payment */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">{t('paymentTitle')}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl mb-2">💵</p>
            <p className="font-semibold">{t('cash')}</p>
            <p className="text-muted-foreground text-xs mt-1">{t('cashNote')}</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl mb-2">📱</p>
            <p className="font-semibold">{t('zelle')}</p>
            <p className="text-muted-foreground text-xs mt-1">{t('zelleNote')}</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl mb-2">🏦</p>
            <p className="font-semibold">{t('bankTransfer')}</p>
            <p className="text-muted-foreground text-xs mt-1">{t('bankTransferNote')}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mt-4">{t('paymentTerms')}</p>
      </section>

      <hr className="my-8" />

      {/* Contact */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Phone className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">{t('questionsTitle')}</h2>
        </div>
        <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{
          __html: t('questionsBody').replace(
            '<link>hupper.motors@gmail.com</link>',
            '<a href="mailto:hupper.motors@gmail.com" class="underline text-foreground">hupper.motors@gmail.com</a>'
          )
        }} />
      </section>
    </div>
  );
}
