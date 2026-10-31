/** Fail before publishing an application whose Clerk middleware cannot start. */
export function assertClerkBuildEnvironment(env) {
  const names = ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"];
  const missing = names.filter((name) => !env[name]?.trim());
  if (missing.length) {
    const rename = env.CLERK_PUBLISHABLE_KEY
      ? " CLERK_PUBLISHABLE_KEY is set, but Next.js requires NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY."
      : "";
    throw new Error(`[Kachko build configuration] Missing ${missing.join(", ")}.${rename} Set the exact names in the frontend Vercel project's environment used by this deployment, then rebuild.`);
  }
  for (const name of names) {
    if (/\s/.test(env[name])) {
      throw new Error(`[Kachko build configuration] ${name} contains whitespace. Paste only the key value, without surrounding spaces or line breaks.`);
    }
  }
  const publishableMode = /^pk_(test|live)_/.exec(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)?.[1];
  const secretMode = /^sk_(test|live)_/.exec(env.CLERK_SECRET_KEY)?.[1];
  if (!publishableMode || !secretMode || publishableMode !== secretMode) {
    throw new Error("[Kachko build configuration] Use a pk_test_/sk_test_ or pk_live_/sk_live_ Clerk key pair from the same instance. Key values are intentionally omitted.");
  }
}
