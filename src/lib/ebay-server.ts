import eBayApi from "ebay-api";

let ebayClient: InstanceType<typeof eBayApi> | null = null;

export function getEbayClient(): InstanceType<typeof eBayApi> {
  if (ebayClient) return ebayClient;

  const isProduction = process.env.EBAY_ENVIRONMENT === "PRODUCTION";

  ebayClient = new eBayApi({
    appId: process.env.EBAY_CLIENT_ID!,
    certId: process.env.EBAY_CLIENT_SECRET!,
    sandbox: !isProduction,
    siteId: eBayApi.SiteId.EBAY_US,
    marketplaceId: eBayApi.MarketplaceId.EBAY_US,
    ruName: process.env.EBAY_RU_NAME,
    scope: [
      "https://api.ebay.com/oauth/api_scope",
      "https://api.ebay.com/oauth/api_scope/sell.inventory",
      "https://api.ebay.com/oauth/api_scope/sell.account",
    ],
  });

  // Set the refresh token if available (for sell operations)
  if (process.env.EBAY_REFRESH_TOKEN) {
    ebayClient.OAuth2.setCredentials({
      access_token: "",
      refresh_token: process.env.EBAY_REFRESH_TOKEN,
      expires_in: 0,
    });
  }

  return ebayClient;
}
