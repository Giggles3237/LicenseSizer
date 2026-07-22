import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import LicenseResizerTrialCTA from "./app/blog/trial-cta";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    a: ({ href = "", children, ...props }) => {
      const internal = href.startsWith("/");
      if (internal) return <Link href={href} {...props}>{children}</Link>;
      return <a href={href} rel="noreferrer" target="_blank" {...props}>{children}</a>;
    },
    LicenseResizerTrialCTA,
    ...components,
  };
}
