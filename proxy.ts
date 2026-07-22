import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Pass the sign-in/sign-up URLs explicitly: in the Next 16 proxy runtime the
// NEXT_PUBLIC_CLERK_* env fallbacks are not reliably populated, which makes
// auth.protect() redirect back to the current URL in an endless reload loop.
const authenticatedProxy = clerkMiddleware({ signInUrl: "/sign-in", signUpUrl: "/sign-up" });

export default process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? authenticatedProxy
  : () => NextResponse.next();

export const config = {
  matcher: [
    "/((?!_next|\\.well-known|[^?]*\\.(?:html?|css|js(?!on)|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
