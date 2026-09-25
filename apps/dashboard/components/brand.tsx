"use client";

import Link from "next/link";
import { useId } from "react";

export function BrandMark({
  href = "/",
  compact = false,
}: {
  href?: string;
  compact?: boolean;
}) {
  const gid = useId().replace(/:/g, "");
  return (
    <Link href={href} className="brand-mark">
      <span className="brand-glyph" aria-hidden>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="8" fill={`url(#${gid})`} />
          <path
            d="M7.2 19.2 11.1 8.8h2.15l1.55 5.55c.18.66.32 1.22.42 1.7h.06c.1-.5.25-1.05.44-1.7L17.3 8.8h2.12L15.5 19.2h-2.2l-1.52-5.42a18 18 0 0 1-.42-1.78h-.05c-.12.58-.26 1.16-.44 1.78L9.38 19.2H7.2Z"
            fill="white"
          />
          <defs>
            <linearGradient id={gid} x1="4" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3D8BFF" />
              <stop offset="1" stopColor="#22C8A3" />
            </linearGradient>
          </defs>
        </svg>
      </span>
      <span className="brand-copy">
        <span className="brand-name">Whizan</span>
        {!compact && <span className="brand-sub">Cloud Services</span>}
      </span>
    </Link>
  );
}
