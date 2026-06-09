"use client";

import Image from "next/image";
import { useState } from "react";
import { BRAND_ASSETS, BRAND_NAME } from "@/lib/brand";

type BrandLogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  showPlaceholder?: boolean;
};

const SIZE = { sm: 36, md: 48, lg: 72 };

export function BrandLogo({ className = "", size = "md", showPlaceholder = true }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);
  const px = SIZE[size];

  if (failed && showPlaceholder) {
    return (
      <div className={`brand-slot brand-slot--logo ${className}`} style={{ width: px, height: px }}>
        <span>LOGO</span>
      </div>
    );
  }

  return (
    <div className={`brand-logo-wrap ${className}`} style={{ width: px, height: px }}>
      <Image
        src={BRAND_ASSETS.logo}
        alt={BRAND_NAME}
        width={px}
        height={px}
        className="brand-logo-img"
        onError={() => setFailed(true)}
        unoptimized
      />
    </div>
  );
}
