export const privacyNotice = {
  label: "Privacy policy · draft for review",
  introduction: "This draft describes data flows currently present in this storefront. It has not been reviewed for legal compliance and must be checked against the final business, service providers, retention periods, and applicable law before publication.",
  sections: [
    {
      title: "Information the storefront handles",
      paragraphs: [
        "When you use an account, the configured authentication provider (Clerk) processes account details such as your email address and profile information. Signed-in carts, wishlists, and orders are associated with your account.",
        "When an order is submitted, the store records the customer, contact, shipping, item, and order details needed to display that order. Checkout currently records payment as pending; payment collection and fulfillment integrations are not configured.",
        "A contact request stores the name, email address, optional order number, message, and submission time for review in the admin dashboard. Newsletter signup stores an email address, subscription status, and hashes of time-limited verification and unsubscribe tokens. Verified subscribers may receive new-product announcement emails through the configured email provider.",
        "To limit automated form submissions, the contact and newsletter forms store an HMAC hash derived from a requester network address for up to 24 hours; the raw address is not stored in the rate-limit collection.",
        "Guest cart and wishlist features may use browser cookies or local storage. Production pages also load Vercel Analytics; hosting, authentication, and other service-provider processing details should be verified before launch.",
      ],
    },
    {
      title: "How information is used",
      paragraphs: [
        "Information is used to provide account, cart, wishlist, order, contact-request, and newsletter-subscription features, and to operate and protect the storefront. Contact requests are not currently emailed to staff.",
      ],
    },
    {
      title: "Choices and questions",
      paragraphs: [
        "You can unsubscribe from a newsletter subscription using the secure unsubscribe link shown after signup. For privacy questions or requests, use the contact form. Applicable rights, identity verification, response process, and retention schedules must be confirmed by the store operator before launch.",
      ],
    },
  ],
}

export const termsNotice = {
  label: "Terms & conditions · draft for review",
  introduction: "This draft is informational and is not legal advice. It must be reviewed and completed by the store operator and qualified counsel before the storefront is used for commercial transactions.",
  sections: [
    {
      title: "Products and availability",
      paragraphs: [
        "Product descriptions, images, materials, dimensions, and availability are shown on the relevant product pages when provided. Contact the store with questions about a specific item before relying on details that are not listed.",
      ],
    },
    {
      title: "Orders and payment",
      paragraphs: [
        "The current checkout records an order with payment status pending. A submitted order is not confirmation that payment was collected, accepted, or that dispatch will occur. Payment processing and fulfillment services are not configured.",
      ],
    },
    {
      title: "Shipping, returns, and cancellations",
      paragraphs: [
        "Shipping regions, costs, delivery estimates, returns, cancellations, and refunds have not been configured. Those terms must be published and confirmed by the store operator before accepting commercial orders.",
      ],
    },
    {
      title: "Accounts and contact",
      paragraphs: [
        "Keep account credentials secure and provide accurate information when using account, order, and support features. Contact requests are stored for review; no response-time commitment or email notification is currently configured.",
      ],
    },
    {
      title: "Terms still to complete",
      paragraphs: [
        "The operator should complete the governing business identity, jurisdiction, pricing/tax treatment, payment and fulfillment terms, returns process, liability terms, and effective date after legal review.",
      ],
    },
  ],
}
