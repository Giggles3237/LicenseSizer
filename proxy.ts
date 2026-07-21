import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const authenticatedProxy = clerkMiddleware();

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
