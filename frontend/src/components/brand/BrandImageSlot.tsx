"use client";

import Image from "next/image";
import { useState } from "react";

type BrandImageSlotProps = {
  src: string;
  alt?: string;
  className?: string;
  placeholderLabel?: string;
  fill?: boolean;
  objectFit?: "cover" | "contain";
};

/** Capa de imagen de marca con placeholder si el archivo no existe aún */
export function BrandImageSlot({
  src,
  alt = "",
  className = "",
  placeholderLabel = "IMAGEN",
  fill = true,
  objectFit = "cover",
}: BrandImageSlotProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`brand-slot brand-slot--image ${className}`}>
        <span>{placeholderLabel}</span>
        <small>{src.replace("/brand/", "")}</small>
      </div>
    );
  }

  return (
    <div className={`brand-image-layer ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill={fill}
        className={`brand-image-layer__img object-${objectFit}`}
        onError={() => setFailed(true)}
        unoptimized
      />
    </div>
  );
}
