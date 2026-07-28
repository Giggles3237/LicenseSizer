import Link from "next/link";
import Image from "next/image";

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
      <Image className="brand-logo" src="/LicenseResizerLogo.webp" width={384} height={384} alt="" priority />
      <span className="sr-only">LicenseResizer</span>
    </Link>
  );
}
