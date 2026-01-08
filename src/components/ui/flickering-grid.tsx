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

// Eye shape path functions
function isInsideEye(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  eyeWidth: number,
  eyeHeight: number
): boolean {
  // Normalize coordinates relative to center
  const nx = (x - centerX) / (eyeWidth / 2);
  const ny = (y - centerY) / (eyeHeight / 2);

  // Eye almond shape using parametric equation
  // Upper and lower curves of an eye shape
  const eyeShape = Math.abs(ny) <= Math.pow(1 - nx * nx, 0.5) * 0.6;
  return Math.abs(nx) <= 1 && eyeShape;
}

function isInsidePupil(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  pupilRadius: number
): boolean {
  const dx = x - centerX;
  const dy = y - centerY;
  return dx * dx + dy * dy <= pupilRadius * pupilRadius;
}

function isInsideIris(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  irisRadius: number
): boolean {
  const dx = x - centerX;
  const dy = y - centerY;
  return dx * dx + dy * dy <= irisRadius * irisRadius;
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
      dpr: number
    ) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "transparent";
      ctx.fillRect(0, 0, width, height);

      // Eye pattern calculations
      const centerX = (cols * (squareSize + gridGap)) / 2;
      const centerY = (rows * (squareSize + gridGap)) / 2;
      const eyeWidth = cols * (squareSize + gridGap) * 0.7;
      const eyeHeight = rows * (squareSize + gridGap) * 0.4;
      const irisRadius = Math.min(eyeWidth, eyeHeight) * 0.25;
      const pupilRadius = irisRadius * 0.4;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          let opacity = squares[i * rows + j];
          const x = i * (squareSize + gridGap) + squareSize / 2;
          const y = j * (squareSize + gridGap) + squareSize / 2;

          if (maskPattern === "eye") {
            const inEye = isInsideEye(x, y, centerX, centerY, eyeWidth, eyeHeight);
            const inIris = isInsideIris(x, y, centerX, centerY, irisRadius);
            const inPupil = isInsidePupil(x, y, centerX, centerY, pupilRadius);

            if (inPupil) {
              // Pupil: high contrast, minimal flicker
              opacity = 0.9 + Math.random() * 0.1;
            } else if (inIris) {
              // Iris: medium-high opacity with some flicker
              opacity = Math.min(opacity * 2.5, 0.8);
            } else if (inEye) {
              // Inside eye (sclera): medium opacity
              opacity = Math.min(opacity * 1.8, 0.6);
            } else {
              // Outside eye: very dim
              opacity = opacity * 0.3;
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
        gridParams.dpr
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
