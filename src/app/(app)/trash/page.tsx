import type { Metadata } from "next";
import { TrashView } from "@/components/trash-view";

export const metadata: Metadata = { title: "Trash · BrandVault" };

export default function TrashPage() {
  return <TrashView />;
}
