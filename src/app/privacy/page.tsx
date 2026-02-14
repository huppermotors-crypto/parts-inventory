import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for HuppeR Auto Parts.",
};

export default function PrivacyPolicyPage() {
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
          Back to Store
        </Link>

        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Last updated: February 14, 2026
        </p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">1. About This Site</h2>
            <p className="leading-relaxed">
              HuppeR Auto Parts (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates this website
              as an online catalog of used and refurbished automotive parts. This site does not process
              payments, does not require user registration, and does not use cookies. To purchase a part,
              buyers contact us directly via email or phone.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">2. Information We Collect</h2>
            <p className="leading-relaxed mb-3">
              We collect the following data to understand how the site is used and to improve our services:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Page views:</strong> Which pages are visited and when.
              </li>
              <li>
                <strong>IP address:</strong> Your IP address is stored for analytics and security purposes.
              </li>
              <li>
                <strong>Device &amp; browser info:</strong> Device type (mobile/desktop), browser name,
                and operating system — extracted from the User-Agent header.
              </li>
              <li>
                <strong>Location:</strong> Country determined from your IP address.
              </li>
              <li>
                <strong>Referrer:</strong> The website that directed you here (if any).
              </li>
              <li>
                <strong>Visitor identifier:</strong> A random anonymous ID stored in a cookie to
                distinguish unique visitors (see Section 3 below).
              </li>
            </ul>
            <p className="leading-relaxed mt-3">
              <strong>We do NOT collect:</strong> names, email addresses, phone numbers, payment
              information, or any other personally identifiable information through this website.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">3. Cookies &amp; Tracking</h2>
            <p className="leading-relaxed mb-3">
              This website uses <strong>one cookie</strong> for analytics purposes:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-semibold">Cookie</th>
                    <th className="text-left py-2 pr-4 font-semibold">Purpose</th>
                    <th className="text-left py-2 font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">_hpr_vid</td>
                    <td className="py-2 pr-4">Anonymous visitor identifier — a random ID used to
                      count unique visitors. Contains no personal information.</td>
                    <td className="py-2 whitespace-nowrap">1 year</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="leading-relaxed mt-3">
              We do not use any third-party analytics services (such as Google Analytics).
              Our analytics are entirely self-hosted and privacy-focused.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">4. Third-Party Platforms</h2>
            <p className="leading-relaxed">
              Our parts may also be listed on third-party platforms such as eBay and Facebook Marketplace.
              Those platforms have their own privacy policies that govern any data collected through them.
              We are not responsible for the privacy practices of third-party sites.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">5. Data Security</h2>
            <p className="leading-relaxed">
              The site is served over HTTPS. Analytics data is stored in a secure database with
              row-level security. IP addresses are stored for analytics and security purposes and
              are accessible only to the site administrator.
            </p>
          </section>

          {/* 6 - Disclaimer */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">6. Product Disclaimer — Sold AS IS</h2>
            <div className="bg-muted border rounded-lg p-4 my-3">
              <p className="leading-relaxed font-semibold">
                ALL PARTS ARE SOLD &quot;AS IS&quot; WITH NO WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
              </p>
            </div>
            <p className="leading-relaxed mb-3">
              All automotive parts sold by HuppeR Auto Parts are used, recycled, or refurbished unless
              explicitly stated otherwise. By purchasing any part, the buyer acknowledges and agrees:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Parts are sold <strong>as-is, where-is</strong>, with no warranty of merchantability or
                fitness for a particular purpose.
              </li>
              <li>
                <strong>No returns, no refunds, no exchanges</strong> unless otherwise agreed in writing
                at the time of sale.
              </li>
              <li>
                It is the buyer&apos;s sole responsibility to verify part compatibility with their vehicle
                and to ensure proper installation by a qualified mechanic.
              </li>
              <li>
                HuppeR Auto Parts is not liable for any damages, injuries, or losses resulting from the
                purchase, installation, or use of any part.
              </li>
            </ul>
          </section>

          {/* 7 - Airbags */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">7. Airbag &amp; SRS Safety Notice</h2>
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 my-3">
              <p className="leading-relaxed font-medium text-destructive">
                IMPORTANT SAFETY NOTICE — AIRBAGS &amp; SUPPLEMENTAL RESTRAINT SYSTEMS (SRS)
              </p>
            </div>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                All airbags and SRS components <strong>must be installed by a certified technician</strong>.
                Improper installation can result in serious injury or death.
              </li>
              <li>
                Used airbags are sold as-is. <strong>No guarantee of deployment</strong> is made.
              </li>
              <li>
                The buyer assumes all risk associated with the purchase and use of airbag/SRS components.
              </li>
              <li>
                It is the buyer&apos;s responsibility to verify recall status at{" "}
                <a
                  href="https://www.nhtsa.gov/recalls"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  nhtsa.gov/recalls
                </a>{" "}
                before installation.
              </li>
              <li>
                Sale and installation of used airbags is regulated under federal and state laws.
                Compliance is the buyer&apos;s responsibility.
              </li>
            </ul>
          </section>

          {/* 8 - Limitation */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">8. Limitation of Liability</h2>
            <p className="leading-relaxed">
              To the fullest extent permitted by law, HuppeR Auto Parts, its owners, employees, and
              affiliates shall not be liable for any direct, indirect, incidental, consequential, or
              punitive damages arising from the purchase, installation, or use of any products. Our
              maximum liability shall not exceed the purchase price of the product in question.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">9. Children&apos;s Privacy</h2>
            <p className="leading-relaxed">
              This website is not intended for individuals under the age of 18.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">10. Changes to This Policy</h2>
            <p className="leading-relaxed">
              We may update this policy from time to time. Changes will be posted on this page.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">11. Contact Us</h2>
            <p className="leading-relaxed">
              Questions about this policy or our products:
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
