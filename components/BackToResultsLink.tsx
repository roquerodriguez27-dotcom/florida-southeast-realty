"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

interface BackToResultsLinkProps {
  href: string;
  label: string;
  preferHistory?: boolean;
}

export default function BackToResultsLink({
  href,
  label,
  preferHistory = false,
}: BackToResultsLinkProps) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const modifiedClick =
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey;

    if (modifiedClick || !preferHistory || window.history.length <= 1) return;

    event.preventDefault();
    router.back();
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-tide/25 bg-white px-4 py-2.5 text-sm font-medium text-tide shadow-sm transition-colors hover:border-hibiscus hover:text-hibiscus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hibiscus focus-visible:ring-offset-2"
    >
      <span aria-hidden="true">←</span>
      {label}
    </Link>
  );
}
