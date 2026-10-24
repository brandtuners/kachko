import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { AdminLayout } from "../../features/admin/admin-console";

export default async function Layout({ children }: { children: ReactNode }) {
  await auth.protect();
  return <AdminLayout>{children}</AdminLayout>;
}
