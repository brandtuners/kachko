import type { ReactNode } from "react";
import { AdminLayout } from "../../features/admin/admin-console";

export default function Layout({ children }: { children: ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
