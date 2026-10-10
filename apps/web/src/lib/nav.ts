export type NavIcon = "list" | "maybe" | "star" | "check" | "download" | "chart";

/** Keys of the mark counts, used to live-update badges after marking. */
export type CountKey = "all" | "maybe" | "interested" | "appliedTo" | "notInterested";

export interface NavLink {
  href: string;
  label: string;
  icon: NavIcon;
  countKey: CountKey | null;
  count: number | null;
}

export const navIconPaths: Record<NavIcon, string> = {
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  maybe: "M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  check: "M5 12l4 4L19 6",
  download: "M12 3v12m0 0l-5-5m5 5l5-5M4 19h16",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
};

export function navLinks(counts?: {
  all: number;
  interested: number;
  maybe: number;
  appliedTo: number;
}): NavLink[] {
  return [
    { href: "/", label: "All Listings", icon: "list", countKey: null, count: null },
    {
      href: "/interested",
      label: "Interested",
      icon: "star",
      countKey: "interested",
      count: counts?.interested ?? null,
    },
    {
      href: "/maybe",
      label: "Maybe",
      icon: "maybe",
      countKey: "maybe",
      count: counts?.maybe ?? null,
    },
    {
      href: "/applied-to",
      label: "Applied to",
      icon: "check",
      countKey: "appliedTo",
      count: counts?.appliedTo ?? null,
    },
    {
      href: "/exports",
      label: "Exports",
      icon: "download",
      countKey: null,
      count: null,
    },
    { href: "/charts", label: "Analytics", icon: "chart", countKey: null, count: null },
  ];
}
