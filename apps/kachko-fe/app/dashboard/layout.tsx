import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { DashboardLayout } from "../../features/dashboard/dashboard-layout";

export default async function Layout({ children }: { children: ReactNode }) {
  await auth.protect();
  return <DashboardLayout>{children}</DashboardLayout>;
}
