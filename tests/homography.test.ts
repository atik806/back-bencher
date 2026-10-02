import { describe, expect, it } from "vitest";
import { apply, invert, rectToQuad, type Pt } from "@/render/homography";

describe("homography", () => {
  const quad: Pt[] = [
    [120, 300],
    [700, 320],
    [900, 780],
    [40, 760],
  ];
  const H = rectToQuad(600, 733, quad)!;

  it("maps the element corners onto the quad", () => {
    const corners: Pt[] = [
      [0, 0],
      [600, 0],
      [600, 733],
      [0, 733],
    ];
    corners.forEach(([x, y], i) => {
      const [sx, sy] = apply(H, x, y);
      expect(sx).toBeCloseTo(quad[i][0], 6);
      expect(sy).toBeCloseTo(quad[i][1], 6);
    });
  });

  it("inverse maps screen points back onto the paper", () => {
    const inv = invert(H)!;
    const [sx, sy] = apply(H, 210, 455);
    const [x, y] = apply(inv, sx, sy);
    expect(x).toBeCloseTo(210, 6);
    expect(y).toBeCloseTo(455, 6);
  });

  it("handles a pure affine (parallelogram) quad", () => {
    const A = rectToQuad(100, 100, [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ])!;
    expect(apply(A, 50, 25)).toEqual([50, 25]);
  });
});
