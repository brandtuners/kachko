import type { Metadata } from "next";
import { PublicPageRoute, publicPageMetadata } from "../../u/[username]/page";

export async function generateMetadata({ params }: { params: Promise<{ username: string; pageSlug: string }> }): Promise<Metadata> {
  const { username, pageSlug } = await params;
  return publicPageMetadata(decodeURIComponent(username), decodeURIComponent(pageSlug));
}

export default async function AdditionalPublicPage({ params }: { params: Promise<{ username: string; pageSlug: string }> }) {
  const { username, pageSlug } = await params;
  return <PublicPageRoute username={decodeURIComponent(username)} pageSlug={decodeURIComponent(pageSlug)} />;
}
