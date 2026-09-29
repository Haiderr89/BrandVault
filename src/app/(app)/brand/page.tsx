import type { Metadata } from "next";
import { BrandEditor } from "@/components/brand-editor";

export const metadata: Metadata = { title: "Brand kit · BrandVault" };

export default function BrandPage() {
  return <BrandEditor />;
}
