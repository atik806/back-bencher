"use client";

/**
 * Your own hands holding the phone, in the phone's 300×620 frame (overflow visible).
 * `layer="back"` is drawn behind the phone (palms, sleeves); `"front"` on top (thumbs, fingertips).
 */
const SKIN = "#c48b5f";
const SKIN_DARK = "#9c6a44";
const SKIN_LIGHT = "#dba57a";
const SLEEVE = "#eef1f4";
const SLEEVE_SHADE = "#c9d0da";

export function Hands({ layer, spread = 0 }: { layer: "back" | "front"; spread?: number }) {
  const s = spread; // extra outward angle for the sleeves (raised phone = arms more spread)
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
      width={300}
      height={620}
      viewBox="0 0 300 620"
      style={{ zIndex: layer === "back" ? 0 : 20 }}
    >
      <defs>
        <linearGradient id={`palmL-${layer}`} x1="0" x2="1">
          <stop offset="0" stopColor={SKIN_LIGHT} />
          <stop offset="1" stopColor={SKIN} />
        </linearGradient>
        <linearGradient id={`palmR-${layer}`} x1="0" x2="1">
          <stop offset="0" stopColor={SKIN} />
          <stop offset="1" stopColor={SKIN_DARK} />
        </linearGradient>
        <linearGradient id={`sleeve-${layer}`} x1="0" x2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor={SLEEVE} />
          <stop offset="1" stopColor={SLEEVE_SHADE} />
        </linearGradient>
      </defs>

      {layer === "back" ? (
        <>
          {/* Forearms flow into the cuffs and palms on either side of the phone. */}
          <path d={`M-48 501 L48 533 L${-10 - s * 60} 1250 L${-190 - s * 80} 1250 Z`} fill={`url(#sleeve-${layer})`} />
          <path d={`M252 533 L348 501 L${490 + s * 80} 1250 L${310 + s * 60} 1250 Z`} fill={`url(#sleeve-${layer})`} />
          <path d="M-51 498 L49 531 L43 555 L-59 522 Z" fill={SLEEVE_SHADE} />
          <path d="M251 531 L351 498 L359 522 L257 555 Z" fill={SLEEVE_SHADE} />
          <path d="M-47 326 C-45 285 -29 260 -7 259 C18 258 34 279 37 312 L40 471 C40 512 22 538 -7 540 C-38 541 -54 516 -56 479 L-57 370 C-57 350 -53 336 -47 326 Z" fill={`url(#palmL-${layer})`} stroke={SKIN_DARK} strokeOpacity={0.45} />
          <path d="M347 326 C345 285 329 260 307 259 C282 258 266 279 263 312 L260 471 C260 512 278 538 307 540 C338 541 354 516 356 479 L357 370 C357 350 353 336 347 326 Z" fill={`url(#palmR-${layer})`} stroke={SKIN_DARK} strokeOpacity={0.45} />
          {/* Knuckles remain visible outside the case; their tips wrap over it in the front layer. */}
          {[290, 333, 376].map((y) => (
            <g key={y}>
              <path d={`M-39 ${y + 7} C-39 ${y - 8} -28 ${y - 16} -13 ${y - 15} C-1 ${y - 14} 8 ${y - 4} 9 ${y + 8} L-37 ${y + 23} Z`} fill={SKIN_LIGHT} stroke={SKIN_DARK} strokeOpacity={0.38} />
              <path d={`M339 ${y + 7} C339 ${y - 8} 328 ${y - 16} 313 ${y - 15} C301 ${y - 14} 292 ${y - 4} 291 ${y + 8} L337 ${y + 23} Z`} fill={SKIN} stroke={SKIN_DARK} strokeOpacity={0.38} />
            </g>
          ))}
        </>
      ) : (
        <>
          {/* Fingertips curl onto the side bezels at the same height as the knuckles. */}
          {[290, 333, 376].map((y) => (
            <g key={y}>
              <path d={`M-15 ${y - 15} C0 ${y - 17} 12 ${y - 7} 14 ${y + 3} C17 ${y + 14} 10 ${y + 22} 1 ${y + 22} C-8 ${y + 21} -16 ${y + 11} -15 ${y - 15} Z`} fill={SKIN_LIGHT} stroke={SKIN_DARK} strokeOpacity={0.5} />
              <path d={`M315 ${y - 15} C300 ${y - 17} 288 ${y - 7} 286 ${y + 3} C283 ${y + 14} 290 ${y + 22} 299 ${y + 22} C308 ${y + 21} 316 ${y + 11} 315 ${y - 15} Z`} fill={SKIN} stroke={SKIN_DARK} strokeOpacity={0.5} />
            </g>
          ))}
          {/* Each thumb starts at its palm and rests across the lower bezel. */}
          <path d="M-41 477 C-40 449 -24 428 -7 411 L20 380 C28 371 39 376 38 387 C38 392 34 402 30 413 L13 460 C4 486 -11 506 -27 500 C-36 497 -42 489 -41 477 Z" fill={SKIN_LIGHT} stroke={SKIN_DARK} strokeOpacity={0.55} />
          <path d="M341 477 C340 449 324 428 307 411 L280 380 C272 371 261 376 262 387 C262 392 266 402 270 413 L287 460 C296 486 311 506 327 500 C336 497 342 489 341 477 Z" fill={SKIN} stroke={SKIN_DARK} strokeOpacity={0.55} />
          <ellipse cx={27} cy={389} rx={5.5} ry={8} fill="#f1c9a8" opacity={0.85} transform="rotate(25 27 389)" />
          <ellipse cx={273} cy={389} rx={5.5} ry={8} fill="#e8bb97" opacity={0.85} transform="rotate(-25 273 389)" />
        </>
      )}
    </svg>
  );
}
