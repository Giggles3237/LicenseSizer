export type DealerDeliveryProfile = {
  dealerName: string;
  publicSlug: string;
  destinationName: string;
  destinationEmail: string;
  destinationPhone: string;
  messageSubject: string;
  messageBody: string;
  backMode: "required" | "optional" | "front-only";
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
  dealerName: "LicenseSizer",
  publicSlug: "",
  destinationName: "Dealership team",
  destinationEmail: "",
  destinationPhone: "",
  messageSubject: "Driver's license copy",
  messageBody: "Attached is the requested copy of my driver's license.",
  backMode: "required",
  pageSize: "letter",
  layout: "stacked",
  quality: "high",
  labels: true,
  cropMarks: false,
};
