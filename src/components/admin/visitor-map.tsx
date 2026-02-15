"use client";

import { ComposableMap, Geographies, Geography } from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Numeric ISO → ISO-2 mapping
const numToIso2: Record<string, string> = {
  "004":"AF","008":"AL","012":"DZ","024":"AO","032":"AR","036":"AU","040":"AT",
  "050":"BD","056":"BE","064":"BT","068":"BO","070":"BA","072":"BW","076":"BR",
  "100":"BG","104":"MM","112":"BY","116":"KH","120":"CM","124":"CA","140":"CF",
  "144":"LK","148":"TD","152":"CL","156":"CN","170":"CO","178":"CG","180":"CD",
  "188":"CR","191":"HR","192":"CU","196":"CY","203":"CZ","208":"DK","214":"DO",
  "218":"EC","818":"EG","222":"SV","231":"ET","233":"EE","246":"FI","250":"FR",
  "268":"GE","276":"DE","288":"GH","300":"GR","320":"GT","332":"HT","340":"HN",
  "348":"HU","352":"IS","356":"IN","360":"ID","364":"IR","368":"IQ","372":"IE",
  "376":"IL","380":"IT","388":"JM","392":"JP","398":"KZ","400":"JO","404":"KE",
  "410":"KR","414":"KW","418":"LA","422":"LB","428":"LV","434":"LY","440":"LT",
  "442":"LU","458":"MY","466":"ML","484":"MX","496":"MN","498":"MD","504":"MA",
  "508":"MZ","512":"OM","516":"NA","524":"NP","528":"NL","554":"NZ","558":"NI",
  "562":"NE","566":"NG","578":"NO","586":"PK","591":"PA","600":"PY","604":"PE",
  "608":"PH","616":"PL","620":"PT","634":"QA","642":"RO","643":"RU","682":"SA",
  "686":"SN","688":"RS","702":"SG","703":"SK","704":"VN","705":"SI","706":"SO",
  "710":"ZA","724":"ES","729":"SD","752":"SE","756":"CH","760":"SY","764":"TH",
  "780":"TT","784":"AE","788":"TN","792":"TR","800":"UG","804":"UA","826":"GB",
  "834":"TZ","840":"US","854":"BF","858":"UY","860":"UZ","862":"VE","887":"YE",
  "894":"ZM",
};

interface Props {
  countryCodeMap: Map<string, number>;
  maxViews: number;
}

export function VisitorMap({ countryCodeMap, maxViews }: Props) {
  function getFill(geoId: string): string {
    const iso2 = numToIso2[geoId];
    if (!iso2) return "#dde5f0";
    const count = countryCodeMap.get(iso2);
    if (!count) return "#dde5f0";
    const intensity = Math.min(1, count / Math.max(1, maxViews));
    const lightness = Math.round(88 - intensity * 55);
    return `hsl(221, 83%, ${lightness}%)`;
  }

  function getTooltip(geoId: string, name: string): string {
    const iso2 = numToIso2[geoId];
    const count = iso2 ? countryCodeMap.get(iso2) : undefined;
    return count ? `${name}: ${count.toLocaleString()} views` : name;
  }

  return (
    <div>
      <ComposableMap
        projectionConfig={{ scale: 155, center: [0, 10] }}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={getFill(String(geo.id))}
                stroke="#fff"
                strokeWidth={0.4}
                style={{
                  default: { outline: "none" },
                  hover: { fill: "hsl(221, 83%, 38%)", outline: "none", cursor: "pointer" },
                  pressed: { outline: "none" },
                }}
              >
                <title>{getTooltip(String(geo.id), geo.properties.name)}</title>
              </Geography>
            ))
          }
        </Geographies>
      </ComposableMap>
      <div className="flex items-center justify-end gap-2 px-4 py-2 text-xs text-muted-foreground">
        <span>Few</span>
        {[88, 72, 56, 40, 33].map((l) => (
          <div
            key={l}
            className="w-4 h-3 rounded-sm border border-slate-200"
            style={{ background: `hsl(221, 83%, ${l}%)` }}
          />
        ))}
        <span>Many</span>
      </div>
    </div>
  );
}
