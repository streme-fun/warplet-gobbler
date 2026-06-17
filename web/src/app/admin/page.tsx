import type { Metadata } from "next";
import AdminDashboard from "@/components/AdminDashboard";

export const metadata: Metadata = {
  title: "Admin | WarpletGobbler",
  description: "Live operator dashboard for WarpletGobbler auctions and streams",
};

export default function AdminPage() {
  return <AdminDashboard />;
}
