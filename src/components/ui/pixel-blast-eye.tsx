"use client";

import { useRef, useEffect, useCallback } from "react";

interface PixelBlastEyeProps {
  className?: string;
  pixelSize?: number;
  gap?: number;
  color?: string;
}

// Bayer 8x8 dithering matrix
const BAYER_8x8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
].map((row) => row.map((v) => v / 64));

// Noise functions
function hash(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const n00 = hash(ix, iy),
    n10 = hash(ix + 1, iy);
  const n01 = hash(ix, iy + 1),
    n11 = hash(ix + 1, iy + 1);
  return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
}

function fbm(x: number, y: number, octaves = 4): number {
  let value = 0,
    amplitude = 0.5,
    frequency = 1,
    maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * smoothNoise(x * frequency, y * frequency);
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / maxValue;
}

interface Ripple {
  x: number;
  y: number;
  startTime: number;
}

export function PixelBlastEye({
  className = "",
  pixelSize = 4,
  gap = 1,
  color = "#f59e0b",
}: PixelBlastEyeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);

  // Mutable state refs (not reactive, for animation loop)
  const stateRef = useRef({
    width: 0,
    height: 0,
    cols: 0,
    rows: 0,
    time: 0,
    lastFrameTime: 0,
    mouseX: 0,
    mouseY: 0,
    lastMouseMoveTime: 0,
    gazeX: 0,
    gazeY: 0,
    targetGazeX: 0,
    targetGazeY: 0,
    autonomousGazeTimer: 0,
    isMouseActive: false,
    ripples: [] as Ripple[],
  });

  // Parse color to RGB
  const colorRgb = useRef({ r: 245, g: 158, b: 11 });
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = Array.from(ctx.getImageData(0, 0, 1, 1).data);
      colorRgb.current = { r, g, b };
    }
  }, [color]);

  const cell = pixelSize + gap;

  // Eye intensity with blend factor
  const getEyeIntensityWithBlend = useCallback(
    (
      x: number,
      y: number,
      centerX: number,
      centerY: number,
      time: number,
      gazeOffsetX: number,
      gazeOffsetY: number,
      cols: number,
      rows: number
    ): { intensity: number; blend: number } => {
      const dx = x - centerX;
      const dy = y - centerY;

      const breathe = 1 + Math.sin(time * 0.5) * 0.03;
      const eyeWidth = Math.min(cols, rows) * 0.42 * breathe;
      const eyeHeight = eyeWidth * 0.38;

      const irisRadius = eyeWidth * 0.35;
      const pupilRadius = irisRadius * 0.4;
      const maxGazeShift = irisRadius * 0.35;

      const irisCenterX = centerX + gazeOffsetX * maxGazeShift;
      const irisCenterY = centerY + gazeOffsetY * maxGazeShift * 0.7;

      const dxIris = x - irisCenterX;
      const dyIris = y - irisCenterY;
      const distFromIris = Math.sqrt(dxIris * dxIris + dyIris * dyIris);

      const almondFactor = Math.pow(Math.abs(dx / eyeWidth), 2.2);
      const adjustedEyeHeight = eyeHeight * (1 - almondFactor * 0.7);
      const almondDist = Math.sqrt((dx / eyeWidth) ** 2 + (dy / adjustedEyeHeight) ** 2);

      let intensity = 0;
      let blend = 0;

      const blendStart = 0.7;
      const blendEnd = 1.8;

      if (almondDist < blendEnd) {
        if (almondDist < blendStart) {
          blend = 1;
        } else {
          const t = (almondDist - blendStart) / (blendEnd - blendStart);
          blend = 1 - t * t * (3 - 2 * t);
        }

        const insideEye = almondDist < 1;

        if (distFromIris < pupilRadius && insideEye) {
          const pupilFade = distFromIris / pupilRadius;
          intensity = 0.02 + pupilFade * 0.04;
        } else if (distFromIris < irisRadius && insideEye) {
          const irisPos = (distFromIris - pupilRadius) / (irisRadius - pupilRadius);
          const angle = Math.atan2(dyIris, dxIris);
          const striation = Math.sin(angle * 32 + time * 0.3) * 0.5 + 0.5;
          const striation2 = Math.sin(angle * 48 - time * 0.2) * 0.5 + 0.5;
          const collarette = Math.abs(irisPos - 0.4) < 0.1 ? 0.06 : 0;
          const limbalDark = irisPos > 0.85 ? (irisPos - 0.85) * 1.5 : 0;
          intensity =
            0.1 + irisPos * 0.12 + striation * 0.04 + striation2 * 0.025 + collarette - limbalDark * 0.08;
        } else if (insideEye) {
          const scleraFade = almondDist;
          intensity = 0.06 + (1 - scleraFade) * 0.04;
          if (almondDist > 0.7) intensity += (almondDist - 0.7) * 0.03;
        } else {
          const falloff = Math.max(0, 1 - (almondDist - 1) * 1.2);
          intensity = 0.06 * falloff;
        }
      }

      return { intensity, blend };
    },
    []
  );

  // Update gaze
  const updateGaze = useCallback((deltaTime: number, state: typeof stateRef.current) => {
    const idleThreshold = 2;
    const timeSinceMouseMove = state.time - state.lastMouseMoveTime;

    if (state.isMouseActive && timeSinceMouseMove < idleThreshold) {
      const canvasCenterX = state.width / 2;
      const canvasCenterY = state.height / 2;
      state.targetGazeX = (state.mouseX - canvasCenterX) / (state.width / 2);
      state.targetGazeY = (state.mouseY - canvasCenterY) / (state.height / 2);
      const mag = Math.sqrt(state.targetGazeX * state.targetGazeX + state.targetGazeY * state.targetGazeY);
      if (mag > 1) {
        state.targetGazeX /= mag;
        state.targetGazeY /= mag;
      }
    } else {
      state.autonomousGazeTimer += deltaTime;
      if (state.autonomousGazeTimer > 2 + Math.random() * 3) {
        state.autonomousGazeTimer = 0;
        const angle = Math.random() * Math.PI * 2;
        const distance = 0.3 + Math.random() * 0.5;
        state.targetGazeX = Math.cos(angle) * distance;
        state.targetGazeY = Math.sin(angle) * distance * 0.6;
      }
    }

    const lerpSpeed = 3;
    state.gazeX += (state.targetGazeX - state.gazeX) * lerpSpeed * deltaTime;
    state.gazeY += (state.targetGazeY - state.gazeY) * lerpSpeed * deltaTime;
  }, []);

  // Ripple effect
  const getRippleEffect = useCallback((x: number, y: number, time: number, ripples: Ripple[]): number => {
    let effect = 0;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const ripple = ripples[i];
      const age = time - ripple.startTime;
      if (age > 3) {
        ripples.splice(i, 1);
        continue;
      }
      const dx = x - ripple.x,
        dy = y - ripple.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const waveRadius = age * 80;
      const distFromWave = Math.abs(dist - waveRadius);
      if (distFromWave < 25) {
        const waveIntensity = 1 - distFromWave / 25;
        const decay = Math.exp(-age * 1.2);
        effect += waveIntensity * decay * 0.4 * Math.sin(dist * 0.15 - age * 8);
      }
    }
    return effect;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = stateRef.current;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      state.width = rect.width;
      state.height = rect.height;
      canvas.width = state.width * dpr;
      canvas.height = state.height * dpr;
      canvas.style.width = `${state.width}px`;
      canvas.style.height = `${state.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.cols = Math.ceil(state.width / cell);
      state.rows = Math.ceil(state.height / cell);
    };

    const draw = (currentTime: number) => {
      const deltaTime = (currentTime - state.lastFrameTime) / 1000;
      state.lastFrameTime = currentTime;

      updateGaze(Math.min(deltaTime, 0.1), state);

      ctx.fillStyle = "#030303";
      ctx.fillRect(0, 0, state.width, state.height);

      const centerX = state.cols / 2;
      const centerY = state.rows / 2;
      const { r, g, b } = colorRgb.current;

      for (let i = 0; i < state.cols; i++) {
        for (let j = 0; j < state.rows; j++) {
          const x = i * cell;
          const y = j * cell;

          const bayerThreshold = BAYER_8x8[j % 8][i % 8];

          const noiseVal = fbm(i * 0.03 + state.time * 0.1, j * 0.03 + state.time * 0.08, 4);
          const flickerNoise = fbm(i * 0.1 + state.time * 0.5, j * 0.1 - state.time * 0.3, 2);

          const bgOpacity = 0.025 + (noiseVal - 0.5) * 0.03 + (flickerNoise - 0.5) * 0.015;

          const { intensity: eyeIntensity, blend } = getEyeIntensityWithBlend(
            i,
            j,
            centerX,
            centerY,
            state.time,
            state.gazeX,
            state.gazeY,
            state.cols,
            state.rows
          );

          let opacity = bgOpacity * (1 - blend) + (eyeIntensity + (noiseVal - 0.5) * 0.06) * blend;

          opacity += getRippleEffect(x, y, state.time, state.ripples);

          const ditheredOpacity = opacity > bayerThreshold * 0.4 ? opacity : opacity * 0.25;
          const finalOpacity = Math.max(0.01, Math.min(0.45, ditheredOpacity));

          const dist = Math.sqrt((i - centerX) ** 2 + (j - centerY) ** 2);
          const irisRadius = Math.min(state.cols, state.rows) * 0.15;
          // Use noise-based variation instead of Math.random() for consistent results
          const colorWarmth = dist < irisRadius ? 1 : 0.9 + (flickerNoise * 0.08);

          ctx.fillStyle = `rgba(${r}, ${Math.floor(g * colorWarmth)}, ${b}, ${finalOpacity})`;
          ctx.fillRect(x, y, pixelSize, pixelSize);
        }
      }

      state.time += 0.016;
      animationRef.current = requestAnimationFrame(draw);
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      state.ripples.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        startTime: state.time,
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      state.mouseX = e.clientX - rect.left;
      state.mouseY = e.clientY - rect.top;
      state.lastMouseMoveTime = state.time;
      state.isMouseActive = true;
    };

    const handleMouseLeave = () => {
      state.isMouseActive = false;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    resize();
    animationRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationRef.current);
      resizeObserver.disconnect();
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [cell, pixelSize, getEyeIntensityWithBlend, updateGaze, getRippleEffect]);

  return (
    <div ref={containerRef} className={`w-full h-full ${className}`}>
      <canvas ref={canvasRef} className="pointer-events-auto" />
    </div>
  );
}
