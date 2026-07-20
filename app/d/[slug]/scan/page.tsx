import { notFound } from "next/navigation";
import LicenseSizerApp from "../../../license-sizer-app";
import { getPublicDealerProfile } from "../../../../lib/dealer-data";

export const dynamic = "force-dynamic";

export default async function DealerScanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let result = null;
  try { result = await getPublicDealerProfile(slug); } catch { notFound(); }
  if (!result) notFound();
  return <LicenseSizerApp deliveryProfile={result.profile} />;
}
