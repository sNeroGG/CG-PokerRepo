import { redirect } from "next/navigation";

import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

export const metadata = {
  title: `${BRAND_NAME} — Live Blackjack`,
  description: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
};

/** La demo estática se reemplazó por la mesa real en /room/[code] */
export default function BlackjackLivePage() {
  redirect("/");
}
