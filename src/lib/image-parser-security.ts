import { disableTypes } from "image-size";

/**
 * Keep the restricted media format policy after upgrading to patched image-size.
 * These parsers were disabled for the 2.0.2 infinite-loop advisories; retaining
 * the restriction avoids expanding accepted formats during a security update.
 *
 * GHSA-w3rx-r6r6-pgpr: ICNS
 * GHSA-5p2g-fcmc-qvqq: JXL and HEIF
 */
export const DISABLED_IMAGE_TYPES = ["heif", "icns", "jxl", "jxl-stream"] as const;

export function disableUnsafeImageParsers(): void {
  disableTypes([...DISABLED_IMAGE_TYPES]);
}
