"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface FlickeringGridProps {
  squareSize?: number;
  gridGap?: number;
  flickerChance?: number;
  color?: string;
  width?: number;
  height?: number;
  className?: string;
  maxOpacity?: number;
  maskPattern?: "eye" | "none";
}

// ===== DETAILED EYE GEOMETRY =====

// Outer eye shape (almond) - using bezier-like curves
function getEyeOuterDistance(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  eyeWidth: number,
  eyeHeight: number
): number {
  const nx = (x - centerX) / (eyeWidth / 2);
  const ny = (y - centerY) / (eyeHeight / 2);

  // Almond shape: tapers at corners
  const cornerTaper = Math.pow(Math.abs(nx), 2.5);
  const eyeCurve = (1 - cornerTaper) * Math.sqrt(1 - Math.min(1, nx * nx));

  // Asymmetric: upper lid slightly higher
  const upperLidOffset = ny < 0 ? 0.15 : 0;
  const adjustedEyeCurve = eyeCurve * (1 + upperLidOffset);

  return Math.abs(ny) / Math.max(0.01, adjustedEyeCurve);
}

function isInsideEye(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  eyeWidth: number,
  eyeHeight: number
): boolean {
  return getEyeOuterDistance(x, y, centerX, centerY, eyeWidth, eyeHeight) <= 1;
}

// Iris detail: returns 0-1 where 0 is center, 1 is edge
function getIrisDistance(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  irisRadius: number
): number {
  const dx = x - centerX;
  const dy = y - centerY;
  return Math.sqrt(dx * dx + dy * dy) / irisRadius;
}

// Pupil with subtle oval shape
function getPupilDistance(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  pupilRadius: number
): number {
  const dx = x - centerX;
  const dy = (y - centerY) * 1.1; // Slightly oval
  return Math.sqrt(dx * dx + dy * dy) / pupilRadius;
}

// Corneal highlight (that bright reflection spot)
function getCornealHighlightIntensity(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  irisRadius: number
): number {
  // Highlight is offset up and to the right
  const highlightX = centerX + irisRadius * 0.3;
  const highlightY = centerY - irisRadius * 0.35;
  const highlightRadius = irisRadius * 0.18;

  const dx = x - highlightX;
  const dy = y - highlightY;
  const dist = Math.sqrt(dx * dx + dy * dy) / highlightRadius;

  if (dist < 1) {
    return Math.pow(1 - dist, 2); // Soft falloff
  }
  return 0;
}

// Secondary smaller highlight
function getSecondaryHighlight(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  irisRadius: number
): number {
  const highlightX = centerX - irisRadius * 0.2;
  const highlightY = centerY - irisRadius * 0.25;
  const highlightRadius = irisRadius * 0.08;

  const dx = x - highlightX;
  const dy = y - highlightY;
  const dist = Math.sqrt(dx * dx + dy * dy) / highlightRadius;

  return dist < 1 ? Math.pow(1 - dist, 1.5) * 0.5 : 0;
}

// Iris radial pattern (like the striations in real irises)
function getIrisRadialPattern(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  time: number
): number {
  const dx = x - centerX;
  const dy = y - centerY;
  const angle = Math.atan2(dy, dx);

  // Multiple frequency patterns for realistic iris texture
  const pattern1 = Math.sin(angle * 24 + time * 0.0005) * 0.5 + 0.5;
  const pattern2 = Math.sin(angle * 36 - time * 0.0003) * 0.5 + 0.5;
  const pattern3 = Math.sin(angle * 12 + time * 0.0002) * 0.5 + 0.5;

  return (pattern1 * 0.4 + pattern2 * 0.35 + pattern3 * 0.25);
}

// Iris concentric rings (collarette pattern)
function getIrisRingPattern(
  distance: number,
  time: number
): number {
  // The collarette is a distinct ring about 1/3 from the pupil
  const collarettePos = 0.4;
  const collaretteWidth = 0.15;
  const collaretteDist = Math.abs(distance - collarettePos) / collaretteWidth;
  const collarette = collaretteDist < 1 ? (1 - collaretteDist) * 0.3 : 0;

  // Subtle concentric ripples
  const ripples = Math.sin(distance * 15 + time * 0.0001) * 0.1 + 0.9;

  return ripples + collarette;
}

// Limbal ring (dark ring around iris edge)
function getLimbalRingIntensity(irisDistance: number): number {
  if (irisDistance > 0.85 && irisDistance < 1.05) {
    const ringCenter = 0.95;
    const ringWidth = 0.1;
    return 1 - Math.abs(irisDistance - ringCenter) / ringWidth;
  }
  return 0;
}

// Eyelid shadow (gradient at top of eye)
function getEyelidShadow(
  y: number,
  centerY: number,
  eyeHeight: number
): number {
  const ny = (y - centerY) / (eyeHeight / 2);
  if (ny < -0.3) {
    return Math.pow(Math.abs(ny + 0.3) / 0.7, 0.8) * 0.4;
  }
  return 0;
}

// Inner corner shadow (caruncle area)
function getInnerCornerShadow(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  eyeWidth: number
): number {
  const nx = (x - centerX) / (eyeWidth / 2);
  const ny = (y - centerY) / (eyeWidth / 4);

  // Shadow on the inner corner (left side)
  if (nx < -0.7) {
    const cornerDist = Math.sqrt(Math.pow(nx + 0.85, 2) + ny * ny * 0.5);
    return Math.max(0, (0.3 - cornerDist) / 0.3) * 0.3;
  }
  return 0;
}

const FlickeringGrid: React.FC<FlickeringGridProps> = ({
  squareSize = 4,
  gridGap = 6,
  flickerChance = 0.3,
  color = "rgb(0, 0, 0)",
  width,
  height,
  className,
  maxOpacity = 0.3,
  maskPattern = "none",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const memoizedColor = useMemo(() => {
    const toRGBA = (color: string) => {
      if (typeof window === "undefined") {
        return `rgba(0, 0, 0,`;
      }
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "rgba(255, 0, 0,";
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = Array.from(ctx.getImageData(0, 0, 1, 1).data);
      return `rgba(${r}, ${g}, ${b},`;
    };
    return toRGBA(color);
  }, [color]);

  const setupCanvas = useCallback(
    (canvas: HTMLCanvasElement, width: number, height: number) => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const cols = Math.floor(width / (squareSize + gridGap));
      const rows = Math.floor(height / (squareSize + gridGap));

      const squares = new Float32Array(cols * rows);
      for (let i = 0; i < squares.length; i++) {
        squares[i] = Math.random() * maxOpacity;
      }

      return { cols, rows, squares, dpr };
    },
    [squareSize, gridGap, maxOpacity]
  );

  const updateSquares = useCallback(
    (squares: Float32Array, deltaTime: number) => {
      for (let i = 0; i < squares.length; i++) {
        if (Math.random() < flickerChance * deltaTime) {
          squares[i] = Math.random() * maxOpacity;
        }
      }
    },
    [flickerChance, maxOpacity]
  );

  const drawGrid = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      cols: number,
      rows: number,
      squares: Float32Array,
      dpr: number,
      time: number
    ) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "transparent";
      ctx.fillRect(0, 0, width, height);

      // Eye geometry calculations
      const gridWidth = cols * (squareSize + gridGap);
      const gridHeight = rows * (squareSize + gridGap);
      const centerX = gridWidth / 2;
      const centerY = gridHeight / 2;

      // Eye proportions
      const eyeWidth = gridWidth * 0.85;
      const eyeHeight = gridHeight * 0.5;
      const irisRadius = Math.min(eyeWidth, eyeHeight) * 0.38;
      const pupilRadius = irisRadius * 0.38;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          let opacity = squares[i * rows + j];
          const x = i * (squareSize + gridGap) + squareSize / 2;
          const y = j * (squareSize + gridGap) + squareSize / 2;

          if (maskPattern === "eye") {
            const inEye = isInsideEye(x, y, centerX, centerY, eyeWidth, eyeHeight);
            const irisDistance = getIrisDistance(x, y, centerX, centerY, irisRadius);
            const pupilDistance = getPupilDistance(x, y, centerX, centerY, pupilRadius);

            // Subtlety multiplier - keeps everything very faint
            const subtlety = 0.25;

            if (!inEye) {
              // Outside the eye - barely visible ambient
              opacity = opacity * 0.08;
            } else if (pupilDistance < 1) {
              // Inside pupil - subtle dark with faint variation
              const highlightIntensity = getCornealHighlightIntensity(x, y, centerX, centerY, irisRadius);
              const secondaryHighlight = getSecondaryHighlight(x, y, centerX, centerY, irisRadius);

              if (highlightIntensity > 0.3) {
                // Faint corneal reflection
                opacity = (0.3 + highlightIntensity * 0.15) * subtlety;
              } else if (secondaryHighlight > 0.2) {
                opacity = (0.25 + secondaryHighlight * 0.1) * subtlety;
              } else {
                // Subtle pupil
                opacity = (0.35 + (1 - pupilDistance) * 0.05 + Math.random() * 0.02) * subtlety;
              }
            } else if (irisDistance < 1) {
              // Inside iris - very subtle texture
              const radialPattern = getIrisRadialPattern(x, y, centerX, centerY, time);
              const ringPattern = getIrisRingPattern(irisDistance, time);
              const limbalRing = getLimbalRingIntensity(irisDistance);
              const highlightIntensity = getCornealHighlightIntensity(x, y, centerX, centerY, irisRadius);

              // Base iris opacity - very faint
              let irisOpacity = 0.2 + (1 - irisDistance) * 0.08;

              // Add subtle radial striations
              irisOpacity += (radialPattern - 0.5) * 0.08;

              // Add ring patterns
              irisOpacity *= (ringPattern * 0.3 + 0.7);

              // Subtle limbal ring
              irisOpacity += limbalRing * 0.1;

              // Faint highlight reflection
              if (highlightIntensity > 0) {
                irisOpacity = irisOpacity * (1 - highlightIntensity * 0.3) + highlightIntensity * 0.35;
              }

              // Subtle flicker
              irisOpacity += (opacity - 0.5) * 0.03;

              opacity = Math.min(0.4, Math.max(0.08, irisOpacity)) * subtlety;
            } else {
              // Sclera (white of eye) - very faint
              const eyeOuterDist = getEyeOuterDistance(x, y, centerX, centerY, eyeWidth, eyeHeight);
              const eyelidShadow = getEyelidShadow(y, centerY, eyeHeight);
              const cornerShadow = getInnerCornerShadow(x, y, centerX, centerY, eyeWidth);

              // Base sclera - very subtle
              let scleraOpacity = 0.15 - (eyeOuterDist - 1) * 0.15;

              // Add faint shadows
              scleraOpacity += eyelidShadow * 0.4;
              scleraOpacity += cornerShadow * 0.4;

              // Gradient darkening near iris
              if (irisDistance < 1.3) {
                scleraOpacity += (1.3 - irisDistance) * 0.06;
              }

              // Very subtle veins/texture near edges
              if (eyeOuterDist > 0.7) {
                const veinNoise = Math.sin(x * 0.3 + y * 0.2 + time * 0.0001) * 0.02;
                scleraOpacity += veinNoise;
              }

              // Flicker
              scleraOpacity += (opacity - 0.5) * 0.02;

              opacity = Math.min(0.2, Math.max(0.04, scleraOpacity)) * subtlety;
            }
          }

          ctx.fillStyle = `${memoizedColor}${opacity})`;
          ctx.fillRect(
            i * (squareSize + gridGap) * dpr,
            j * (squareSize + gridGap) * dpr,
            squareSize * dpr,
            squareSize * dpr
          );
        }
      }
    },
    [memoizedColor, squareSize, gridGap, maskPattern]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let gridParams: ReturnType<typeof setupCanvas>;

    const updateCanvasSize = () => {
      const newWidth = width || container.clientWidth;
      const newHeight = height || container.clientHeight;
      setCanvasSize({ width: newWidth, height: newHeight });
      gridParams = setupCanvas(canvas, newWidth, newHeight);
    };

    updateCanvasSize();

    let lastTime = 0;
    const animate = (time: number) => {
      if (!isInView) return;

      const deltaTime = (time - lastTime) / 1000;
      lastTime = time;

      updateSquares(gridParams.squares, deltaTime);
      drawGrid(
        ctx,
        canvas.width,
        canvas.height,
        gridParams.cols,
        gridParams.rows,
        gridParams.squares,
        gridParams.dpr,
        time
      );
      animationFrameId = requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
    });

    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0 }
    );

    intersectionObserver.observe(canvas);

    if (isInView) {
      animationFrameId = requestAnimationFrame(animate);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [setupCanvas, updateSquares, drawGrid, width, height, isInView]);

  return (
    <div ref={containerRef} className={`w-full h-full ${className}`}>
      <canvas
        ref={canvasRef}
        className="pointer-events-none"
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
        }}
      />
    </div>
  );
};

export { FlickeringGrid };
