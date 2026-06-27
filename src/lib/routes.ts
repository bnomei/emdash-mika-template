/**
 * Canonical storefront paths for links, form hidden fields, and safe redirect
 * fallbacks. Centralizes route strings so Astro pages and action forms stay aligned.
 */
export const mikaTemplateRoutes = {
  account: "/account",
  accountOrders: "/account/orders",
  accountSubscriptions: "/account/subscriptions",
  accountLicenses: "/account/licenses",
  accountDownloads: "/account/downloads",
  cart: "/cart",
  wishlist: "/wishlist",
  products: "/",
  checkoutSuccess: "/checkout/success",
  checkoutCancel: "/checkout/cancel",
} as const;

export function mikaTemplateCheckoutSuccessHref(checkoutId: string): string {
  return `${mikaTemplateRoutes.checkoutSuccess}?checkoutId=${encodeURIComponent(checkoutId)}`;
}
