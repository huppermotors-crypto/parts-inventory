import type { Metadata } from "next";
import Link from "next/link";
import { Package, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for HuppeR Auto Parts - how we collect, use, and protect your information.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Package className="h-6 w-6" />
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
          Back to Store
        </Link>

        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          {/* 1. Introduction */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">1. Introduction</h2>
            <p className="leading-relaxed">
              HuppeR Auto Parts (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates this website
              to sell used and refurbished automotive parts. We are committed to protecting your privacy
              and ensuring that your personal information is handled in a safe and responsible manner.
              This Privacy Policy describes how we collect, use, and protect your information when you
              visit or make a purchase from our website.
            </p>
          </section>

          {/* 2. Information We Collect */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">2. Information We Collect</h2>
            <p className="leading-relaxed mb-3">We may collect the following types of information:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Contact Information:</strong> Name, email address, phone number, and shipping
                address when you contact us or make a purchase.
              </li>
              <li>
                <strong>Vehicle Information:</strong> Year, make, model, and VIN of your vehicle to
                help identify compatible parts.
              </li>
              <li>
                <strong>Transaction Data:</strong> Purchase history, payment method (we do not store
                full credit card numbers), and order details.
              </li>
              <li>
                <strong>Usage Data:</strong> Pages visited, time spent on the site, browser type,
                device information, and IP address collected automatically through cookies and
                analytics tools.
              </li>
              <li>
                <strong>Communication Data:</strong> Messages sent through our contact form, email,
                or social media channels.
              </li>
            </ul>
          </section>

          {/* 3. How We Use Your Information */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">3. How We Use Your Information</h2>
            <p className="leading-relaxed mb-3">We use the collected information to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Process and fulfill your orders and inquiries.</li>
              <li>Communicate with you regarding your purchases, shipping status, and customer service.</li>
              <li>Improve our website, product listings, and overall customer experience.</li>
              <li>Comply with legal obligations and enforce our policies.</li>
              <li>Send promotional communications (only with your consent; you may opt out at any time).</li>
            </ul>
          </section>

          {/* 4. Sharing of Information */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">4. Sharing of Information</h2>
            <p className="leading-relaxed mb-3">
              We do not sell or rent your personal information. We may share your data with:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Shipping Carriers:</strong> To deliver your orders (e.g., USPS, UPS, FedEx).
              </li>
              <li>
                <strong>Payment Processors:</strong> To securely process your payments.
              </li>
              <li>
                <strong>Third-Party Platforms:</strong> Such as eBay or Facebook Marketplace, where
                your part listing data may also appear.
              </li>
              <li>
                <strong>Legal Authorities:</strong> When required by law or to protect our legal rights.
              </li>
            </ul>
          </section>

          {/* 5. Data Security */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">5. Data Security</h2>
            <p className="leading-relaxed">
              We implement industry-standard security measures to protect your personal information,
              including encryption (HTTPS/TLS), secure database hosting, and access controls.
              However, no method of transmission over the Internet is 100% secure. We encourage you
              to take steps to protect your personal information, such as using strong passwords and
              keeping your login credentials confidential.
            </p>
          </section>

          {/* 6. Cookies */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">6. Cookies &amp; Tracking Technologies</h2>
            <p className="leading-relaxed">
              Our website may use cookies and similar technologies to enhance your browsing experience,
              analyze site traffic, and understand user behavior. You may disable cookies in your
              browser settings, but doing so may limit certain functionality of our website.
            </p>
          </section>

          {/* 7. Your Rights */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">7. Your Rights</h2>
            <p className="leading-relaxed mb-3">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access, correct, or delete your personal data.</li>
              <li>Opt out of marketing communications.</li>
              <li>Request a copy of the data we hold about you.</li>
              <li>Restrict or object to certain processing of your data.</li>
            </ul>
            <p className="leading-relaxed mt-3">
              To exercise any of these rights, please contact us at{" "}
              <a href="mailto:hupper.motors@gmail.com" className="underline font-medium">
                hupper.motors@gmail.com
              </a>.
            </p>
          </section>

          {/* 8. Product Safety Disclaimers */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">8. Product Safety &amp; Liability Disclaimers</h2>

            <h3 className="text-lg font-medium mt-5 mb-2">8.1 General Disclaimer</h3>
            <p className="leading-relaxed">
              All automotive parts sold by HuppeR Auto Parts are used, recycled, or refurbished
              unless explicitly stated otherwise. Parts are sold &quot;as-is&quot; with no implied
              warranty of fitness for a particular purpose. It is the buyer&apos;s responsibility to
              verify compatibility with their vehicle and to ensure proper installation by a qualified
              mechanic or technician.
            </p>

            <h3 className="text-lg font-medium mt-5 mb-2">8.2 Airbag &amp; Safety Restraint Systems</h3>
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 my-3">
              <p className="leading-relaxed font-medium text-destructive">
                IMPORTANT SAFETY NOTICE REGARDING AIRBAGS AND SUPPLEMENTAL RESTRAINT SYSTEMS (SRS)
              </p>
            </div>
            <p className="leading-relaxed mb-3">
              HuppeR Auto Parts may sell used airbag modules, airbag assemblies, SRS components, and
              related safety restraint system parts. By purchasing these items, the buyer acknowledges
              and agrees to the following:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Professional Installation Required:</strong> All airbags and SRS components
                must be installed by a certified automotive technician or qualified professional.
                Improper installation can result in serious injury or death.
              </li>
              <li>
                <strong>No Guarantee of Deployment:</strong> Used airbags and SRS components are sold
                as-is. We make no warranty or guarantee that these parts will deploy correctly in the
                event of a collision.
              </li>
              <li>
                <strong>Compliance with Federal Law:</strong> The sale and installation of used airbags
                is regulated under federal and state laws. It is the buyer&apos;s responsibility to
                ensure compliance with all applicable regulations, including but not limited to the
                National Traffic and Motor Vehicle Safety Act.
              </li>
              <li>
                <strong>Assumption of Risk:</strong> The buyer assumes all risk associated with the
                purchase, installation, and use of airbag and SRS components. HuppeR Auto Parts shall
                not be held liable for any personal injury, death, or property damage resulting from
                the use of these products.
              </li>
              <li>
                <strong>No Recalled Parts:</strong> We make reasonable efforts to ensure that airbag
                parts are not subject to active manufacturer recalls. However, it is the buyer&apos;s
                responsibility to verify recall status through the NHTSA website (
                <a
                  href="https://www.nhtsa.gov/recalls"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  nhtsa.gov/recalls
                </a>
                ) before installation.
              </li>
            </ul>

            <h3 className="text-lg font-medium mt-5 mb-2">8.3 Electrical &amp; Electronic Components</h3>
            <p className="leading-relaxed">
              Electronic parts such as ECUs, sensors, and control modules are sold as-is. Compatibility
              and programming may vary by vehicle year, make, model, and trim. Professional
              diagnosis and installation is recommended.
            </p>

            <h3 className="text-lg font-medium mt-5 mb-2">8.4 Limitation of Liability</h3>
            <p className="leading-relaxed">
              To the fullest extent permitted by law, HuppeR Auto Parts, its owners, employees, and
              affiliates shall not be liable for any direct, indirect, incidental, consequential, or
              punitive damages arising from the purchase, installation, or use of any products sold
              through this website. Our maximum liability shall not exceed the purchase price of the
              product in question.
            </p>
          </section>

          {/* 9. Returns & Refunds */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">9. Returns &amp; Refunds Policy</h2>
            <p className="leading-relaxed">
              We accept returns within 30 days of delivery for parts that are defective or
              significantly not as described. Airbag and SRS components are{" "}
              <strong>non-returnable</strong> once installed. Shipping costs for returns are the
              buyer&apos;s responsibility unless the return is due to our error. Please contact us at{" "}
              <a href="mailto:hupper.motors@gmail.com" className="underline font-medium">
                hupper.motors@gmail.com
              </a>{" "}
              to initiate a return.
            </p>
          </section>

          {/* 10. Children's Privacy */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">10. Children&apos;s Privacy</h2>
            <p className="leading-relaxed">
              Our website is not intended for individuals under the age of 18. We do not knowingly
              collect personal information from children. If we become aware that we have collected
              data from a minor, we will take steps to delete it promptly.
            </p>
          </section>

          {/* 11. Changes to Policy */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">11. Changes to This Policy</h2>
            <p className="leading-relaxed">
              We may update this Privacy Policy from time to time. Any changes will be posted on this
              page with the updated date. We encourage you to review this policy periodically.
            </p>
          </section>

          {/* 12. Contact */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">12. Contact Us</h2>
            <p className="leading-relaxed">
              If you have any questions about this Privacy Policy or our practices, please contact us:
            </p>
            <ul className="list-none pl-0 mt-3 space-y-1">
              <li>
                <strong>Business:</strong> HuppeR Auto Parts
              </li>
              <li>
                <strong>Email:</strong>{" "}
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
          <p>
            &copy; {new Date().getFullYear()} HuppeR Auto Parts. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
