import { Metadata } from "next";
import { Truck, Package, DollarSign, MapPin, Phone } from "lucide-react";

export const metadata: Metadata = {
  title: "Shipping & Payment | HuppeR Auto Parts",
  description: "Shipping policy and accepted payment methods for HuppeR Auto Parts.",
};

export default function ShippingPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Shipping &amp; Payment</h1>
      <p className="text-muted-foreground mb-8">
        Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>

      {/* Shipping */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Truck className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Shipping Policy</h2>
        </div>

        <div className="space-y-4 text-sm leading-relaxed">
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Package className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
              <div>
                <p className="font-medium text-green-700">Small &amp; Light Parts — Shipping Available</p>
                <p className="text-muted-foreground mt-1">
                  Small parts such as sensors, switches, trim pieces, emblems, mirrors, headlights, taillights,
                  electrical components, and other compact items can be shipped via USPS or UPS.
                  Shipping cost is additional and will be quoted based on part size, weight, and destination.
                  Contact us before purchasing to confirm shipping availability and cost for your item.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
              <div>
                <p className="font-medium text-red-700">Large &amp; Heavy Parts — Local Pickup Only</p>
                <p className="text-muted-foreground mt-1">
                  Large or heavy items such as doors, hoods, fenders, bumpers, engines, transmissions,
                  axles, and body panels are <strong>not available for shipping</strong>.
                  These items are available for <strong>local pickup only</strong>.
                </p>
              </div>
            </div>
          </div>

          <p>
            <strong>Shipping is arranged separately.</strong> Please contact us via phone or email before
            placing an order if you need shipping. We will confirm availability, provide a shipping quote,
            and arrange payment accordingly.
          </p>

          <p className="text-muted-foreground">
            We are not responsible for shipping damage once the item has been handed to the carrier.
            Insurance is available upon request for an additional fee.
          </p>
        </div>
      </section>

      <hr className="my-8" />

      {/* Payment */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Accepted Payment Methods</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl mb-2">💵</p>
            <p className="font-semibold">Cash</p>
            <p className="text-muted-foreground text-xs mt-1">Local pickup only</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl mb-2">📱</p>
            <p className="font-semibold">Zelle</p>
            <p className="text-muted-foreground text-xs mt-1">Instant bank transfer</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl mb-2">🏦</p>
            <p className="font-semibold">Bank Transfer</p>
            <p className="text-muted-foreground text-xs mt-1">Wire / ACH</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mt-4">
          Payment is due at the time of pickup or prior to shipping.
          For shipped orders, payment must be received and cleared before the item is sent.
          We do not accept credit cards, PayPal, or checks.
        </p>
      </section>

      <hr className="my-8" />

      {/* Contact */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Phone className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Questions?</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Contact us at{" "}
          <a href="mailto:hupper.motors@gmail.com" className="underline text-foreground">
            hupper.motors@gmail.com
          </a>{" "}
          for shipping quotes, payment questions, or to arrange a pickup.
          We typically respond within a few hours during business hours.
        </p>
      </section>
    </div>
  );
}
