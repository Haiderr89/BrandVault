import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryView } from "@/components/library/library-view";
import { Spinner } from "@/components/ui";

export const metadata: Metadata = { title: "Library · BrandVault" };

export default function LibraryPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LibraryView />
    </Suspense>
  );
}
