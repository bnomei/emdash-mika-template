import { disableTypes } from "image-size";

/**
 * image-size 2.0.2 has unpatched infinite-loop advisories in these parsers.
 * EmDash uses image-size for media metadata, so disable the affected formats
 * process-wide until upstream publishes a fixed release.
 *
 * GHSA-w3rx-r6r6-pgpr: ICNS
 * GHSA-5p2g-fcmc-qvqq: JXL and HEIF
 */
export const DISABLED_IMAGE_TYPES = ["heif", "icns", "jxl", "jxl-stream"] as const;

export function disableUnsafeImageParsers(): void {
  disableTypes([...DISABLED_IMAGE_TYPES]);
}
