export type DealerDeliveryProfile = {
  dealerName: string;
  publicSlug: string;
  publicAddress: string;
  publicPhone: string;
  publicEmail: string;
  websiteUrl: string;
  facebookUrl: string;
  logoUrl: string;
  landingHeadline: string;
  landingDescription: string;
  landingCta: string;
  landingTheme: "classic" | "modern" | "minimal";
  brandColor: string;
  accentColor: string;
  destinationName: string;
  destinationEmail: string;
  destinationPhone: string;
  messageSubject: string;
  messageBody: string;
  backMode: "optional" | "front-only";
  pageSize: "letter" | "a4";
  layout: "stacked" | "separate-pages";
  quality: "standard" | "high";
  labels: boolean;
  cropMarks: boolean;
};

export const ACTIVITY_EVENT_TYPES = [
  "session_started",
  "front_captured",
  "back_captured",
  "pdf_created",
  "share_opened",
  "pdf_downloaded",
  "email_opened",
  "text_opened",
  "session_cleared",
] as const;

export type ActivityEventType = typeof ACTIVITY_EVENT_TYPES[number];

export const DEFAULT_DELIVERY_PROFILE: DealerDeliveryProfile = {
  dealerName: "Summit Motor Group",
  publicSlug: "",
  publicAddress: "4100 Summit Parkway\nAnytown, NY 10001",
  publicPhone: "(555) 014-2026",
  publicEmail: "sales@summitmotorgroup.example",
  websiteUrl: "https://summitmotorgroup.example",
  facebookUrl: "",
  logoUrl: "/summit-logo.png",
  landingHeadline: "Send Summit Motor Group your license securely before your visit.",
  landingDescription: "Our sales team needs a true-size license copy to prepare your test drive or paperwork. Capture it on your own phone, create the PDF locally, and choose how to send it to Summit Motor Group.",
  landingCta: "Start secure license capture",
  landingTheme: "classic",
  brandColor: "#06233f",
  accentColor: "#677178",
  destinationName: "Summit sales team",
  destinationEmail: "sales@summitmotorgroup.example",
  destinationPhone: "(555) 014-2026",
  messageSubject: "Driver's license copy for Summit Motor Group",
  messageBody: "Attached is the requested copy of my driver's license for Summit Motor Group.",
  backMode: "optional",
  pageSize: "letter",
  layout: "stacked",
  quality: "high",
  labels: true,
  cropMarks: false,
};
