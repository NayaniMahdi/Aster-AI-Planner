import { cn } from "@/lib/utils";

interface AsterMarkProps {
  size?: number;
  className?: string;
  variant?: "black" | "white" | "default";
}

/**
 * Aster Flagship Logo: The Kinetic Celestial Aperture
 * A bespoke sculpted 3D emblem with 4 kinetic ribbon petals in rotational harmony
 * around a negative-space celestial aperture core.
 * Rendered with pure transparent background, zero borders, zero background container tiles.
 */
export function AsterMark({
  size = 22,
  className,
}: AsterMarkProps) {
  return (
    <img
      src="/assets/aster_logo.png"
      srcSet="/assets/aster_logo_64.png 64w, /assets/aster_logo_128.png 128w, /assets/aster_logo_256.png 256w, /assets/aster_logo.png 632w"
      sizes={`${size}px`}
      alt="Aster Logo"
      width={size}
      height={size}
      style={{ width: `${size}px`, height: `${size}px` }}
      className={cn("shrink-0 select-none object-contain pointer-events-none", className)}
      loading="eager"
      decoding="async"
    />
  );
}

/**
 * Aster Chat & Assistant Logo Emblem
 * Morphs between the kinetic Aster celestial aperture and a clean dismiss state.
 */
export function AsterChatMark({
  size = 24,
  className,
  isOpen = false,
}: {
  size?: number;
  className?: string;
  isOpen?: boolean;
}) {
  if (isOpen) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("shrink-0 select-none transition-transform duration-200 rotate-90", className)}
        aria-hidden="true"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }

  return (
    <img
      src="/assets/aster_logo_128.png"
      alt="Aster Assistant"
      width={size}
      height={size}
      style={{ width: `${size}px`, height: `${size}px` }}
      className={cn("shrink-0 select-none object-contain pointer-events-none transition-transform duration-200", className)}
      loading="eager"
      decoding="async"
    />
  );
}

/**
 * Aster Brand Component
 * Pristine freestanding mark and Sora semibold wordmark.
 * ZERO borders, ZERO background container boxes.
 * Pure luxury minimalism.
 */
export function AsterBrand({
  collapsed = false,
  className,
  size = 36,
  onClick,
}: {
  collapsed?: boolean;
  className?: string;
  size?: number;
  onClick?: () => void;
}) {
  if (collapsed) {
    return (
      <div
        onClick={onClick}
        className={cn(
          "group flex items-center justify-center select-none cursor-pointer transition-opacity duration-150 hover:opacity-90",
          className
        )}
      >
        <AsterMark
          size={30}
          className="transition-transform duration-200 group-hover:scale-105"
        />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-center select-none min-w-0 cursor-pointer transition-opacity duration-150 hover:opacity-90",
        className
      )}
    >
      <img
        src="/assets/aster_brand_full.png"
        alt="Aster"
        className="h-10 w-auto max-w-[155px] select-none object-contain pointer-events-none transition-transform duration-200 group-hover:scale-[1.02] dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] dark:brightness-110"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}

// Backward-compatible aliases for legacy imports
export { AsterMark as NorthstarMark };
export { AsterBrand as NorthstarBrand };
