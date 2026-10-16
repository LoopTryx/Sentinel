'use client';

import { type CSSProperties, type SVGProps, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';

export type TextLoopShape = 'wave' | 'circle' | 'infinity' | 'arch' | 'line';
export type TextLoopDirection = 'forward' | 'reverse';

export interface TextLoopProps {
  text?: string;
  fitWidth?: boolean;
  shape?: TextLoopShape;
  path?: string;
  speed?: number;
  direction?: TextLoopDirection;
  separator?: string;
  curviness?: number;
  tilt?: number;
  fontSize?: number;
  fontWeight?: number | string;
  letterSpacing?: number;
  uppercase?: boolean;
  color?: string;
  ribbon?: boolean;
  ribbonColor?: string;
  ribbonWidth?: number;
  edgeFade?: number;
  pauseOnHover?: boolean;
  cross?: boolean;
  crossColor?: string;
  crossAngle?: number;
  draggable?: boolean;
  scrollBoost?: number;
  outline?: boolean;
  outlineWidth?: number;
  className?: string;
  style?: CSSProperties;
}

interface Metrics {
  length: number;
  reps: number;
  crossLength: number;
  crossReps: number;
}

interface FadeStop {
  offset: number;
  opacity: number;
}

const VIEW_W = 1200;
const VIEW_H = 520;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;
const EDGE_PAD = 6;
const FADE_STEPS = 8;
const MAX_FLING = 2600;
const MAX_BOOST = 1600;

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
const wrap = (v: number, length: number) => ((v % length) + length) % length;

const circleRadius = (curviness: number, ribbonWidth: number) =>
  Math.min(90 + Math.max(0, curviness) * 0.95, Math.max(20, CY - Math.max(0, ribbonWidth) / 2 - EDGE_PAD));

const buildPath = (shape: TextLoopShape, curviness: number, ribbonWidth: number, mirrored = false): string => {
  const c = Math.max(0, curviness);
  const room = Math.max(20, CY - Math.max(0, ribbonWidth) / 2 - EDGE_PAD);
  const flip = mirrored ? -1 : 1;

  switch (shape) {
    case 'circle': {
      const r = circleRadius(curviness, ribbonWidth);
      if (mirrored) {
        const rx = r * 1.22;
        const ry = r * 0.42;
        return `M ${CX - rx} ${CY} A ${rx} ${ry} 0 1 1 ${CX + rx} ${CY} A ${rx} ${ry} 0 1 1 ${CX - rx} ${CY} Z`;
      }
      return `M ${CX - r} ${CY} A ${r} ${r} 0 1 1 ${CX + r} ${CY} A ${r} ${r} 0 1 1 ${CX - r} ${CY} Z`;
    }
    case 'infinity': {
      const r = 150 + c * 1.4;
      const h = Math.min(60 + c * 0.95, room);
      return [
        `M ${CX} ${CY}`,
        `C ${CX + r * 0.55} ${CY - h} ${CX + r} ${CY - h} ${CX + r} ${CY}`,
        `C ${CX + r} ${CY + h} ${CX + r * 0.55} ${CY + h} ${CX} ${CY}`,
        `C ${CX - r * 0.55} ${CY - h} ${CX - r} ${CY - h} ${CX - r} ${CY}`,
        `C ${CX - r} ${CY + h} ${CX - r * 0.55} ${CY + h} ${CX} ${CY}`,
        'Z'
      ].join(' ');
    }
    case 'arch': {
      const rise = Math.min(120 + c * 1.1, room * 2) * flip;
      return `M 120 ${CY + rise / 2} Q ${CX} ${CY - rise * 1.5} ${VIEW_W - 120} ${CY + rise / 2}`;
    }
    case 'line':
      return `M -320 ${CY} L ${VIEW_W + 320} ${CY}`;
    case 'wave':
    default: {
      const a = Math.min(c * 2.2, room * 2) * flip;
      return `M -320 ${CY} Q -160 ${CY - a} 0 ${CY} T 320 ${CY} T 640 ${CY} T 960 ${CY} T 1280 ${CY} T ${VIEW_W + 320} ${CY}`;
    }
  }
};

const buildFade = (edgeFade: number): FadeStop[] => {
  const width = Math.min(1, Math.max(0, edgeFade)) * 0.3;
  if (width <= 0) return [];
  const stops: FadeStop[] = [];
  for (let i = 0; i <= FADE_STEPS; i++) {
    const t = i / FADE_STEPS;
    stops.push({ offset: t * width, opacity: smootherstep(t) });
  }
  for (let i = FADE_STEPS; i >= 0; i--) {
    const t = i / FADE_STEPS;
    stops.push({ offset: 1 - t * width, opacity: smootherstep(t) });
  }
  return stops;
};

const parseHex = (value?: string): number[] | null => {
  const match = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(String(value || '').trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].replace(/./g, ch => ch + ch) : match[1];
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
};

const tint = (color: string, amount: number): string => {
  const rgb = parseHex(color);
  if (!rgb) return color;
  return `#${rgb
    .map(v =>
      Math.round(v + (255 - v) * amount)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
};

const inkOn = (color: string): string => {
  const rgb = parseHex(color);
  if (!rgb) return '#ffffff';
  const [r, g, b] = rgb.map(v => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.2 ? '#120f17' : '#ffffff';
};

const TextLoop = ({
  text = 'React ✦ Bits',
  fitWidth = false,
  shape = 'wave',
  path,
  speed = 90,
  direction = 'forward',
  separator = '✦',
  curviness = 90,
  tilt = 0,
  fontSize = 46,
  fontWeight = 800,
  letterSpacing = 2,
  uppercase = true,
  color,
  ribbon = true,
  ribbonColor = '#5227FF',
  ribbonWidth = 86,
  edgeFade = 0,
  pauseOnHover = true,
  cross = false,
  crossColor,
  crossAngle = 16,
  draggable = false,
  scrollBoost = 0,
  outline = false,
  outlineWidth = 1.5,
  className = '',
  style = {}
}: TextLoopProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const crossPathRef = useRef<SVGPathElement | null>(null);
  const measureRef = useRef<SVGTextElement | null>(null);
  const headRef = useRef<SVGTextPathElement | null>(null);
  const tailRef = useRef<SVGTextPathElement | null>(null);
  const crossHeadRef = useRef<SVGTextPathElement | null>(null);
  const crossTailRef = useRef<SVGTextPathElement | null>(null);
  const progressRef = useRef(0);

  const [metrics, setMetrics] = useState<Metrics>({ length: 0, reps: 1, crossLength: 0, crossReps: 1 });
  const [lineWidth,setLineWidth]=useState(VIEW_W);
  const responsiveLine=fitWidth&&!path&&shape==='line'&&!cross;
  useIsomorphicLayoutEffect(()=>{
    const root=rootRef.current;if(!root||!responsiveLine)return;
    const measure=()=>{const width=root.getBoundingClientRect().width;if(Number.isFinite(width)&&width>0)setLineWidth(Math.round(clamp(width,120,8192)));};
    measure();const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(measure):null;
    observer?.observe(root);return()=>observer?.disconnect();
  },[responsiveLine]);


  const rawId = useId();
  const pathId = `text-loop-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const crossId = `${pathId}-cross`;
  const fadeId = `${pathId}-fade`;
  const maskId = `${pathId}-mask`;
  const shadowId = `${pathId}-shadow`;
  const underId = `${pathId}-under`;

  const custom = Boolean(path);
  const d = useMemo(() => path || (responsiveLine?`M -320 ${CY} L ${lineWidth+320} ${CY}`:buildPath(shape, curviness, ribbonWidth)), [path, shape, curviness, ribbonWidth, responsiveLine, lineWidth]);
  const crossD = useMemo(() => {
    if (!cross) return '';
    if (path) return path;
    return buildPath(shape, curviness, ribbonWidth, shape === 'wave' || shape === 'arch' || shape === 'circle');
  }, [cross, path, shape, curviness, ribbonWidth]);
  const fade = useMemo(() => buildFade(edgeFade), [edgeFade]);
  const fill = color || (ribbon ? '#ffffff' : 'currentColor');

  const half = cross ? crossAngle / 2 : 0;
  const mainAngle = tilt + half;
  const crossAngleDeg = tilt - half;
  const mainTransform = mainAngle ? `rotate(${mainAngle} ${CX} ${CY})` : undefined;
  const crossTransform = crossAngleDeg ? `rotate(${crossAngleDeg} ${CX} ${CY})` : undefined;
  const crossTape = crossColor || tint(ribbonColor, 0.62);
  const crossFill = ribbon ? inkOn(crossTape) : crossColor || 'currentColor';
  const crossDim = !ribbon && !crossColor ? 0.45 : 1;

  const unit = useMemo(() => {
    const base = uppercase ? String(text).slice(0,256).toUpperCase() : String(text).slice(0,256);
    const gap = separator ? `\u00A0${String(separator).slice(0,16)}\u00A0` : '\u00A0\u00A0\u00A0';
    return `${base}${gap}`;
  }, [text, separator, uppercase]);

  const textStyle = useMemo<CSSProperties>(
    () => ({ fontSize: `${fontSize}px`, fontWeight, letterSpacing: `${letterSpacing}px` }),
    [fontSize, fontWeight, letterSpacing]
  );

  useIsomorphicLayoutEffect(() => {
    const pathEl = pathRef.current;
    const measureEl = measureRef.current;
    if (!pathEl || !measureEl) return undefined;

    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      let length = 0;
      let unitWidth = 0;
      let crossLength = 0;
      try {
        length = pathEl.getTotalLength();
        unitWidth = measureEl.getComputedTextLength();
        crossLength = crossPathRef.current ? crossPathRef.current.getTotalLength() : 0;
      } catch {
        return;
      }
      if (!Number.isFinite(length)||length<=0||length>100000||!Number.isFinite(unitWidth)) return;

      const repsFor = (total: number) => (unitWidth > 0 ? Math.min(256,Math.max(1, Math.round(total / unitWidth))) : 1);
      const next = { length, reps: repsFor(length), crossLength, crossReps: repsFor(crossLength) };
      setMetrics(prev =>
        prev.length === next.length &&
        prev.reps === next.reps &&
        prev.crossLength === next.crossLength &&
        prev.crossReps === next.crossReps
          ? prev
          : next
      );
    };

    measure();
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [d, crossD, unit, fontSize, fontWeight, letterSpacing]);

  useIsomorphicLayoutEffect(() => {
    const { length, crossLength } = metrics;
    const head = headRef.current;
    const tail = tailRef.current;
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!head || !tail || !root || !svg || !length) return undefined;

    const crossHead = crossHeadRef.current;
    const crossTail = crossTailRef.current;
    const crossPaths = cross && crossHead && crossTail && crossLength > 0 ? [crossHead, crossTail] : null;

    let travel = progressRef.current * length;
    const apply = () => {
      const offset = wrap(travel, length);
      progressRef.current = offset / length;
      head.setAttribute('startOffset', String(offset));
      tail.setAttribute('startOffset', String(offset - length));
      if (crossPaths) {
        const crossOffset = wrap(-travel, crossLength);
        crossPaths[0].setAttribute('startOffset', String(crossOffset));
        crossPaths[1].setAttribute('startOffset', String(crossOffset - crossLength));
      }
    };
    apply();

    const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reduced=motion?.matches??false;
    const sign = direction === 'reverse' ? -1 : 1;
    let base = reduced ? 0 : clamp(speed,0,500) * sign;
    const hover = { scale: 1 };
    const angle = (mainAngle * Math.PI) / 180;
    const circular = !custom && shape === 'circle';
    const radius = circleRadius(curviness, ribbonWidth);
    const boosting = scrollBoost > 0 && !reduced;

    let fling = 0;
    let boost = 0;
    let scrollVelocity = 0;
    let scrollAt = 0;
    let scrollPos = 0;
    let scrollSource: EventTarget | null = null;
    let dragging = false;
    let pointerId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    let center = { x: 0, y: 0 };
    let running = false, visible = true, manualPaused = false, hovered = false;
    let elapsed=0;

    const tick = (_: number, deltaMs: number) => {
      if(document.hidden||!visible||reduced){stop();return;}
      if (dragging) return;
      elapsed+=Math.max(0,deltaMs)/1000;
      if(elapsed<1/24)return;
      const dt = Math.min(0.1,elapsed);elapsed=0;
      fling *= Math.exp(-dt / 0.55);
      if (boosting) {
        if (performance.now() - scrollAt > 90) scrollVelocity *= Math.exp(-dt / 0.12);
        const target = clamp(scrollVelocity * scrollBoost * 0.35 * sign, -MAX_BOOST, MAX_BOOST);
        boost += (target - boost) * (1 - Math.exp(-dt / 0.18));
      }
      const v = base * hover.scale + fling + boost;
      if (Math.abs(v) < 0.01) return;
      travel += v * dt;
      apply();
    };

    const start = () => {
      if (running || reduced || document.hidden || !visible) return;
      running = true;
      gsap.ticker.add(tick);
    };
    const stop = () => {
      if (!running) return;
      running = false;elapsed=0;
      gsap.ticker.remove(tick);
    };

    const glide = (paused: boolean) => {
      gsap.killTweensOf(hover);
      if(reduced||document.hidden||!visible){hover.scale=paused?0:1;stop();return;}
      if(!paused)start();
      gsap.to(hover,{scale:paused?0:1,duration:paused?0.6:0.9,ease:paused?'power2.out':'power2.inOut',overwrite:true,onComplete:()=>{if(paused){fling=0;boost=0;stop();}}});
    };
    const onEnter=(event:PointerEvent)=>{if(event.pointerType!=='touch'){hovered=true;glide(true);}};
    const onLeave=()=>{hovered=false;glide(manualPaused);};
    const onFocus=()=>{manualPaused=true;glide(true);};
    const onBlur=()=>{manualPaused=false;glide(hovered);};
    const onKey=(event:KeyboardEvent)=>{
      if(event.key===' '||event.key==='Enter'){event.preventDefault();manualPaused=!manualPaused;glide(manualPaused||hovered);}
      if(draggable&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();travel+=event.key==='ArrowLeft'?-40:40;apply();}
    };
    const onVisibility=()=>{gsap.killTweensOf(hover);if(document.hidden)stop();else if(!manualPaused&&!hovered)start();};
    const onMotion=()=>{reduced=motion?.matches??false;base=reduced?0:clamp(speed,0,500)*sign;fling=0;boost=0;gsap.killTweensOf(hover);if(reduced)stop();else if(!manualPaused&&!hovered)start();};
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      dragging = true;stop();
      pointerId = event.pointerId;
      try{root.setPointerCapture?.(event.pointerId);}catch{/* Unsupported capture. */}
      lastX = event.clientX;
      lastY = event.clientY;
      lastT = performance.now();
      velocity = base * hover.scale + fling + boost;
      const rect = svg.getBoundingClientRect();
      center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      root.style.cursor = 'grabbing';
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return;
      const now = performance.now();
      let delta: number;
      if (circular) {
        let turn =
          Math.atan2(event.clientY - center.y, event.clientX - center.x) -
          Math.atan2(lastY - center.y, lastX - center.x);
        if (turn > Math.PI) turn -= Math.PI * 2;
        if (turn < -Math.PI) turn += Math.PI * 2;
        delta = turn * radius;
      } else {
        const matrix=svg.getScreenCTM?.();
        const pixelsPerUnit=matrix?Math.hypot(matrix.a,matrix.b):0;
        const scale = pixelsPerUnit>0?1/pixelsPerUnit:VIEW_W / (svg.getBoundingClientRect().width || VIEW_W);
        delta = ((event.clientX - lastX) * Math.cos(angle) + (event.clientY - lastY) * Math.sin(angle)) * scale;
      }
      travel += delta;
      apply();
      const dt = Math.max(1, now - lastT) / 1000;
      velocity = velocity * 0.6 + (delta / dt) * 0.4;
      lastX = event.clientX;
      lastY = event.clientY;
      lastT = now;
    };
    const onUp = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return;
      dragging = false;
      const captured=pointerId;pointerId = null;
      try{if(captured!==null&&root.hasPointerCapture?.(captured))root.releasePointerCapture(captured);}catch{/* Already released. */}
      root.style.cursor = '';
      if (reduced||manualPaused||hovered||event.type==='pointercancel'||event.type==='lostpointercapture'){fling=0;return;}
      start();
      const release = performance.now() - lastT > 90 ? 0 : clamp(velocity, -MAX_FLING, MAX_FLING);
      fling = release - (base * hover.scale + boost);
    };

    const onScroll = (event: Event) => {
      const source = event.target;
      const isPage = source === document || source === document.documentElement || source === document.body;
      if (!isPage && !(source instanceof Node && source.contains(root))) return;
      const pos = isPage ? window.scrollY : (source as Element).scrollTop;
      const now = performance.now();
      if (source !== scrollSource || now - scrollAt > 200) {
        scrollSource = source;
        scrollPos = pos;
        scrollAt = now;
        return;
      }
      const instant = (pos - scrollPos) / (Math.max(8, now - scrollAt) / 1000);
      scrollVelocity = scrollVelocity * 0.5 + instant * 0.5;
      scrollPos = pos;
      scrollAt = now;
    };

    document.addEventListener('visibilitychange',onVisibility);
    motion?.addEventListener?.('change',onMotion);
    root.addEventListener('focus',onFocus);root.addEventListener('blur',onBlur);root.addEventListener('keydown',onKey);
    if (pauseOnHover) {
      root.addEventListener('pointerenter', onEnter);
      root.addEventListener('pointerleave', onLeave);
    }
    if (draggable) {
      root.addEventListener('pointerdown', onDown);
      root.addEventListener('pointermove', onMove);
      root.addEventListener('pointerup', onUp);
      root.addEventListener('pointercancel', onUp);root.addEventListener('lostpointercapture',onUp);
    }
    if (boosting) window.addEventListener('scroll', onScroll, { capture: true, passive: true });

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            visible=entry.isIntersecting;
            if (visible&&!manualPaused&&!hovered) start();
            else {gsap.killTweensOf(hover);stop();}
          })
        : null;
    if (observer) observer.observe(root);
    else start();

    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange',onVisibility);motion?.removeEventListener?.('change',onMotion);
      root.removeEventListener('focus',onFocus);root.removeEventListener('blur',onBlur);root.removeEventListener('keydown',onKey);
      try{if(pointerId!==null&&root.hasPointerCapture?.(pointerId))root.releasePointerCapture(pointerId);}catch{/* Already released. */}
      stop();
      gsap.killTweensOf(hover);
      root.style.cursor = '';
      root.removeEventListener('pointerenter', onEnter);
      root.removeEventListener('pointerleave', onLeave);
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);root.removeEventListener('lostpointercapture',onUp);
      window.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, [
    metrics,
    speed,
    direction,
    pauseOnHover,
    draggable,
    scrollBoost,
    cross,
    custom,
    shape,
    mainAngle,
    curviness,
    ribbonWidth
  ]);

  const loopText = unit.repeat(metrics.reps);
  const crossText = unit.repeat(metrics.crossReps);
  const fitLength = metrics.length || undefined;
  const crossFit = metrics.crossLength || undefined;
  const paint = (ink: string, opacity: number): SVGProps<SVGTextElement> =>
    outline
      ? {
          fill: 'none',
          stroke: ink,
          strokeOpacity: opacity,
          strokeWidth: outlineWidth,
          strokeLinejoin: 'round'
        }
      : { fill: ink, fillOpacity: opacity };
  const mainPaint = paint(fill, 1);
  const crossPaint = paint(crossFill, crossDim);

  return (
    <div
      ref={rootRef}
      className={`relative w-full overflow-hidden ${draggable ? 'cursor-grab touch-pan-y' : ''} ${className}`.trim()}
      style={style}
      tabIndex={pauseOnHover||draggable?0:undefined}
      role="group"
      aria-label={`${text} ribbon. Space pauses or resumes. Arrow keys move the ribbon.`}
    >
      <svg
        ref={svgRef}
        className="block w-full h-auto"
        viewBox={!custom&&shape==='line'&&!cross?`0 ${CY-ribbonWidth/2-10} ${responsiveLine?lineWidth:VIEW_W} ${ribbonWidth+20}`:`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio={!custom&&shape==='line'&&!cross?"xMidYMid slice":"xMidYMid meet"}
        role="img"
        aria-label={text}
      >
        <defs>
          {fade.length > 0 && (
            <linearGradient id={fadeId} x1="0" y1="0" x2="1" y2="0">
              {fade.map((stop, i) => (
                <stop key={i} offset={stop.offset} stopColor="#ffffff" stopOpacity={stop.opacity} />
              ))}
            </linearGradient>
          )}
          {fade.length > 0 && (
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={responsiveLine?lineWidth:VIEW_W} height={VIEW_H}>
              <rect width={responsiveLine?lineWidth:VIEW_W} height={VIEW_H} fill={`url(#${fadeId})`} />
            </mask>
          )}
          {cross && ribbon && (
            <filter
              id={shadowId}
              filterUnits="userSpaceOnUse"
              x={-VIEW_W}
              y={-VIEW_H}
              width={VIEW_W * 3}
              height={VIEW_H * 3}
            >
              <feGaussianBlur stdDeviation={Math.max(4, ribbonWidth * 0.11)} />
            </filter>
          )}
          {cross && ribbon && (
            <mask
              id={underId}
              maskUnits="userSpaceOnUse"
              x={-VIEW_W}
              y={-VIEW_H}
              width={VIEW_W * 3}
              height={VIEW_H * 3}
            >
              <g transform={crossTransform}>
                <path
                  d={crossD}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={ribbonWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            </mask>
          )}
        </defs>

        <text ref={measureRef} className="invisible pointer-events-none" style={textStyle} aria-hidden="true">
          {unit}
        </text>

        <g mask={fade.length > 0 ? `url(#${maskId})` : undefined}>
          {cross && (
            <g transform={crossTransform}>
              <path
                ref={crossPathRef}
                id={crossId}
                d={crossD}
                fill="none"
                stroke={ribbon ? crossTape : 'none'}
                strokeWidth={ribbon ? ribbonWidth : 0}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <text
                className="select-none"
                style={textStyle}
                {...crossPaint}
                dominantBaseline="central"
                aria-hidden="true"
                textLength={crossFit}
                lengthAdjust="spacing"
              >
                <textPath ref={crossHeadRef} href={`#${crossId}`} startOffset={0}>
                  {crossText}
                </textPath>
              </text>

              <text
                className="select-none"
                style={textStyle}
                {...crossPaint}
                dominantBaseline="central"
                aria-hidden="true"
                textLength={crossFit}
                lengthAdjust="spacing"
              >
                <textPath ref={crossTailRef} href={`#${crossId}`} startOffset={0}>
                  {crossText}
                </textPath>
              </text>
            </g>
          )}

          {cross && ribbon && (
            <g mask={`url(#${underId})`}>
              <g filter={`url(#${shadowId})`} transform={`translate(0 ${Math.max(4, ribbonWidth * 0.08)})`}>
                <g transform={mainTransform}>
                  <path
                    d={d}
                    fill="none"
                    stroke="#000000"
                    strokeOpacity={0.42}
                    strokeWidth={ribbonWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              </g>
            </g>
          )}

          <g transform={mainTransform}>
            <path
              ref={pathRef}
              id={pathId}
              d={d}
              fill="none"
              stroke={ribbon ? ribbonColor : 'none'}
              strokeWidth={ribbon ? ribbonWidth : 0}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <text
              className="select-none"
              style={textStyle}
              {...mainPaint}
              dominantBaseline="central"
              aria-hidden="true"
              textLength={fitLength}
              lengthAdjust="spacing"
            >
              <textPath ref={headRef} href={`#${pathId}`} startOffset={0}>
                {loopText}
              </textPath>
            </text>

            <text
              className="select-none"
              style={textStyle}
              {...mainPaint}
              dominantBaseline="central"
              aria-hidden="true"
              textLength={fitLength}
              lengthAdjust="spacing"
            >
              <textPath ref={tailRef} href={`#${pathId}`} startOffset={0}>
                {loopText}
              </textPath>
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
};

export default TextLoop;
