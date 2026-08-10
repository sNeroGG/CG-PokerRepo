"use client";

import Image from "next/image";
import { BRAND_ASSETS, BRAND_NAME } from "@/lib/brand";

/** Logo compacto para reversos de carta y espacios muy pequeños */
export function CardBackBrandLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`card-back-brand-logo ${className}`.trim()} aria-hidden>
      <Image
        src={BRAND_ASSETS.logo}
        alt={BRAND_NAME}
        fill
        className="card-back-brand-logo__img"
        sizes="84px"
        unoptimized
      />
    </div>
  );
}
