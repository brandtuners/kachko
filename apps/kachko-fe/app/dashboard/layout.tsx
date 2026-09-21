import type { ReactNode } from "react";
import { DashboardLayout } from "../../features/dashboard/dashboard-layout";

export default function Layout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
