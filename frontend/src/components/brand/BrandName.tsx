import { BRAND_NAME, BRAND_NAME_SHORT } from "@/lib/brand";

type BrandNameProps = {
  variant?: "full" | "short" | "header";
  className?: string;
};

/** Nombre de marca consistente en toda la app */
export function BrandName({ variant = "full", className = "" }: BrandNameProps) {
  if (variant === "short") {
    return <span className={className}>{BRAND_NAME_SHORT}</span>;
  }

  if (variant === "header") {
    return (
      <span className={className}>
        <span className="auth-title-gold">CHOLOS GROUP</span>{" "}
        <span className="text-white">CORPORATION</span>
      </span>
    );
  }

  return (
    <span className={className}>
      <span className="auth-title-gold">CHOLOS GROUP</span>{" "}
      <span className="text-white">CORPORATION</span>
    </span>
  );
}

export { BRAND_NAME, BRAND_NAME_SHORT };
