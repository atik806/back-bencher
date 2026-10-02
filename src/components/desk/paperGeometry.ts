import type { Homography } from "@/render/homography";

/**
 * Live, per-frame geometry of the paper on your desk (written by the 3D view, read by the
 * phone camera). Kept outside React so it can update 60×/s without re-rendering.
 */
export const paperGeometry: {
  /** paper px → view px */
  H: Homography | null;
  /** view px → paper px */
  inv: Homography | null;
  page: number;
} = { H: null, inv: null, page: 0 };
