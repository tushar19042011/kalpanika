export type FAQ = {
  category: "Orders" | "Products" | "Accounts" | "Contact"
  question: string
  answer: string
}

export const faqs: FAQ[] = [
  {
    category: "Orders",
    question: "Does placing an order confirm payment or dispatch?",
    answer: "No. Checkout currently records an order with pending payment. It does not confirm that payment was collected or that an item has shipped.",
  },
  {
    category: "Orders",
    question: "Where can I find my order details?",
    answer: "Sign in and visit your account to review orders associated with your account. If you need help, include your order number in the contact form.",
  },
  {
    category: "Orders",
    question: "How long does shipping take, and what does it cost?",
    answer: "Shipping availability, delivery estimates, and charges have not been configured for this storefront. Please contact us before relying on a delivery date or cost.",
  },
  {
    category: "Orders",
    question: "What is the returns, cancellation, and refund policy?",
    answer: "A return, cancellation, and refund policy has not been configured. Please contact us before placing an order if you need to confirm an order-specific option.",
  },
  {
    category: "Products",
    question: "How do I care for an item?",
    answer: "Care depends on the item. Read the care notes on its product page and visit the Care Guide for general information.",
  },
  {
    category: "Products",
    question: "What are products made from?",
    answer: "Material details are shown on individual product pages when available. Please contact us if a product page does not answer your question.",
  },
  {
    category: "Accounts",
    question: "How do I manage my account?",
    answer: "Use the Account link to sign in or create an account. Account access is provided by the configured authentication service.",
  },
  {
    category: "Contact",
    question: "How do I contact Kalpanika?",
    answer: "Use the Contact form to submit a support request. Requests are stored for review in the admin dashboard; an email notification or response-time commitment is not configured.",
  },
  {
    category: "Contact",
    question: "Will I receive newsletter emails?",
    answer: "Confirm your email address to subscribe. Confirmed subscribers receive announcements when new products are published, and every announcement includes an unsubscribe link. Email delivery depends on the store's configured email provider.",
  },
]
