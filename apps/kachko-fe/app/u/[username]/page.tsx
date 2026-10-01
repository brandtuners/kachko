import type { Metadata } from "next";
import { PublicPageRoute, publicPageMetadata } from "../../../features/page/public-page-route";

// Public profile page (§8.1, §6.3, AD-08). Server-rendered for SEO + speed.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return publicPageMetadata(username);
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <PublicPageRoute username={decodeURIComponent(username)} />;
}
