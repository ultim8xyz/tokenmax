import type { MetadataRoute } from "next";

/** Signup is open, but the pages behind it are members reading their own
 *  numbers — nothing here is meant for search engines. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
