import Link from "next/link";

export default function LicenseResizerBrand({
  href = "/",
  className = "",
  label = "LicenseResizer home",
}: {
  href?: string;
  className?: string;
  label?: string;
}) {
  const classes = ["brand logo-brand", className].filter(Boolean).join(" ");

  return (
    <Link className={classes} href={href} aria-label={label}>
      <img className="brand-logo" src="/LicenseResizerLogo.png" alt="" />
      <span className="sr-only">LicenseResizer</span>
    </Link>
  );
}
