import type { MetadataRoute } from "next";

/** Nothing here is meant for search engines; the whole instance is invite-only. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
