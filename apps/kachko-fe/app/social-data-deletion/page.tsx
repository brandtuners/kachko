import Link from 'next/link';

export const dynamic = 'force-dynamic';
export default async function SocialDataDeletion({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  let complete = false;
  if (code && /^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/.test(code)) {
    try {
      const url = new URL(`/api/v1/social/deletion-status/${encodeURIComponent(code)}`, process.env.API_URL ?? 'http://localhost:4000');
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      complete = response.ok;
    } catch { /* Display a recoverable confirmation failure. */ }
  }
  return <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6"><h1 className="text-3xl font-extrabold">{complete ? 'Instagram data deleted' : 'Instagram data deletion'}</h1><p>{complete ? 'The connected Instagram account, saved tokens, social insights, and its automation data have been removed from Kachko.' : 'We could not verify this deletion confirmation. You can disconnect Instagram from Social insights or contact Kachko support.'}</p><Link href="/legal/privacy" className="font-bold underline">Privacy policy</Link></main>;
}
