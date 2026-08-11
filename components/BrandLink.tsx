"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BrandLink() {
  const pathname = usePathname();
  const isBafa = pathname?.startsWith("/bafa");

  return (
    <Link className="brand" href={isBafa ? "/bafa" : "/"}>
      {isBafa ? "BAFA Manager" : "KiCéKi 🤫"}
    </Link>
  );
}
