import React, { useMemo, useRef, useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { InventoryItem } from '../types';
import { format, startOfDay, addDays, getDay, isFirstDayOfMonth } from 'date-fns';

interface TimelineProps {
  items: InventoryItem[];
}

const smoothPath = (points: {x: number, y: number}[]) => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
     const p0 = i > 0 ? points[i-1] : points[i];
     const p1 = points[i];
     const p2 = points[i+1];
     const p3 = i !== points.length - 2 ? points[i+2] : p2;
     
     const cp1x = p1.x + (p2.x - p0.x) / 6;
     const cp1y = p1.y + (p2.y - p0.y) / 6;
     const cp2x = p2.x - (p3.x - p1.x) / 6;
     const cp2y = p2.y - (p3.y - p1.y) / 6;
     
     d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
};

export function Timeline({ items }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTargetRef = useRef<number | null>(null);
  const [zoom, setZoom] = useState(400); // pixels per hour
  const zoomRef = useRef(zoom);
  const [containerHeight, setContainerHeight] = useState(500);
  const hasInitialScrolled = useRef(false);
  const [now, setNow] = useState(Date.now());

  // Clock for the red line
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const [graphColors, setGraphColors] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('nexus_graph_colors');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { 'Pain': '#ef4444', 'Nausea': '#eab308', 'Fatigue': '#3b82f6', 'Heartburn': '#f97316', 'Mood': '#22c55e' };
  });

  const updateColor = (cat: string, newColor: string) => {
    setGraphColors(prev => {
        const next = { ...prev, [cat]: newColor };
        localStorage.setItem('nexus_graph_colors', JSON.stringify(next));
        return next;
    });
  };

  useLayoutEffect(() => {
     zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    if (containerRef.current) {
      const observer = new ResizeObserver((entries) => {
         for (let entry of entries) {
            setContainerHeight(entry.contentRect.height);
         }
      });
      observer.observe(containerRef.current);
      setContainerHeight(containerRef.current.clientHeight);
      return () => observer.disconnect();
    }
  }, []);

  const timelineItems = useMemo(() => {
    return items.filter(item => {
      const notes = item.notes?.trim().toLowerCase() || "";
      const isSleep = notes.startsWith('sleep');
      const isWake = notes.startsWith('wake');
      if (isSleep || isWake) return true;
      if (item.category && item.category !== "(No Item)") return true;
      return false;
    }).sort((a, b) => {
      const aTime = (a.loggedAt || a.createdAt)?.toMillis?.() || 0;
      const bTime = (b.loggedAt || b.createdAt)?.toMillis?.() || 0;
      return aTime - bTime; // Ascending left to right
    });
  }, [items]);

  const { minTime, maxTime, durationMs } = useMemo(() => {
    if (timelineItems.length === 0) return { minTime: 0, maxTime: 0, durationMs: 0 };
    const min = (timelineItems[0].loggedAt || timelineItems[0].createdAt)?.toMillis?.() || Date.now();
    const max = (timelineItems[timelineItems.length - 1].loggedAt || timelineItems[timelineItems.length - 1].createdAt)?.toMillis?.() || Date.now();
    
    // Pad by 12 hours on both sides
    let paddedMin = min - 12 * 3600000;
    let paddedMax = max + 12 * 3600000;
    
    // Ensure we always have at least 6 weeks (42 days) of timeline to scroll/zoom through
    const sixWeeksMs = 42 * 24 * 3600000;
    if (paddedMax - paddedMin < sixWeeksMs) {
      const extra = sixWeeksMs - (paddedMax - paddedMin);
      paddedMin -= extra / 2;
      paddedMax += extra / 2;
    }

    const dur = Math.max(paddedMax - paddedMin, 24 * 3600000);
    return { minTime: paddedMin, maxTime: paddedMax, durationMs: dur };
  }, [timelineItems]);

  const totalWidth = (durationMs / 3600000) * zoom;

  const getPosition = useCallback((t: number) => {
    if (durationMs === 0) return 0;
    return ((t - minTime) / 3600000) * zoom;
  }, [minTime, zoom, durationMs]);

  // Lane logical sorting
  const itemsWithLanes = useMemo(() => {
    const sorted = [...timelineItems];
    const cardWidth = 160 + 10; // Reduced card width (w-40 = 10rem = 160px) + margin
    
    // Split into top and bottom candidates
    // We'll keep the side assignment but then stack within sides
    const lanes: { id: string, side: 'top' | 'bottom', laneIdx: number }[] = [];
    const sideLanes: Record<'top' | 'bottom', number[]> = { top: [], bottom: [] };
    
    return sorted.map((item, idx) => {
      const time = (item.loggedAt || item.createdAt)?.toMillis?.() || 0;
      const x = getPosition(time);
      const side: 'top' | 'bottom' = idx % 2 === 0 ? 'top' : 'bottom';
      
      const currentSideLanes = sideLanes[side];
      let assignedLane = 0;
      
      // Find first lane where the last item's x + cardWidth is < this item's x
      let found = false;
      for (let l = 0; l < currentSideLanes.length; l++) {
        if (currentSideLanes[l] + cardWidth < x) {
          currentSideLanes[l] = x;
          assignedLane = l;
          found = true;
          break;
        }
      }
      
      if (!found) {
        assignedLane = currentSideLanes.length;
        currentSideLanes.push(x);
      }
      
      return { item, side, laneIdx: assignedLane };
    });
  }, [timelineItems, getPosition]);

  const sleepSegments = useMemo(() => {
    const segments: { start: number, end: number }[] = [];
    let startMs: number | null = null;
    for (const item of timelineItems) {
      const isSleep = item.notes?.trim().toLowerCase() === 'sleep';
      const isWake = item.notes?.trim().toLowerCase().startsWith('wake');
      const time = (item.loggedAt || item.createdAt)?.toMillis?.() || 0;
      if (isSleep) {
        startMs = time;
      } else if (isWake && startMs !== null) {
        segments.push({ start: startMs, end: time });
        startMs = null;
      }
    }
    if (startMs !== null) {
      segments.push({ start: startMs, end: Math.min(Date.now(), maxTime) });
    }
    return segments;
  }, [timelineItems, maxTime]);

  const graphData = useMemo(() => {
    const types = ["Pain", "Nausea", "Fatigue", "Heartburn", "Mood"];
    // Group items by category
    const grouped: Record<string, { x: number, y: number, item: InventoryItem }[]> = {};
    types.forEach(t => grouped[t] = []);

    for (const item of timelineItems) {
      if (item.category && grouped[item.category] !== undefined && item.quantity !== undefined) {
        const time = (item.loggedAt || item.createdAt)?.toMillis?.() || 0;
        grouped[item.category].push({ x: time, y: item.quantity, item });
      }
    }

    return Object.fromEntries(
      Object.entries(grouped).filter(([k, arr]) => arr.length > 0)
    );
  }, [timelineItems]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            return;
        }

        if (e.shiftKey) {
            e.preventDefault();
            container.scrollLeft += e.deltaY;
            return;
        }

        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;

        // Smooth factor based on deltaY (prevents massive jumps from trackpad momentum)
        const zoomDelta = -e.deltaY * 0.005; 
        const factor = Math.exp(zoomDelta);
        let currentZoom = zoomRef.current;
        let startScrollLeft = scrollTargetRef.current !== null ? scrollTargetRef.current : container.scrollLeft;

        // Clamp to prevent accumulating out-of-bounds scrolls
        const currentTotalWidth = (durationMs / 3600000) * currentZoom;
        const maxScrollLeft = Math.max(0, currentTotalWidth - rect.width);
        startScrollLeft = Math.max(0, Math.min(startScrollLeft, maxScrollLeft));

        const mouseXInTimeline = startScrollLeft + mouseX;

        const newZoom = Math.max(0.1, Math.min(currentZoom * factor, 10000));
        const ratio = newZoom / currentZoom;
        let newScrollLeft = (mouseXInTimeline * ratio) - mouseX;
        
        // Clamp new expected scroll
        const newTotalWidth = (durationMs / 3600000) * newZoom;
        const newMaxScrollLeft = Math.max(0, newTotalWidth - rect.width);
        newScrollLeft = Math.max(0, Math.min(newScrollLeft, newMaxScrollLeft));

        scrollTargetRef.current = newScrollLeft;
        zoomRef.current = newZoom;
        setZoom(newZoom);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    
    if (timelineItems.length > 0 && container.scrollLeft === 0 && !hasInitialScrolled.current) {
       let startTarget = 0;
       try {
           const saved = localStorage.getItem('nexus_timeline_view');
           if (saved) {
               const { centerTimeMs, savedZoom } = JSON.parse(saved);
               setZoom(savedZoom);
               zoomRef.current = savedZoom;
               startTarget = ((centerTimeMs - minTime) / 3600000) * savedZoom - container.clientWidth / 2;
           } else {
               const nowPx = ((Date.now() - minTime) / 3600000) * zoomRef.current;
               startTarget = nowPx - container.clientWidth / 2;
           }
       } catch {
           const nowPx = ((Date.now() - minTime) / 3600000) * zoomRef.current;
           startTarget = nowPx - container.clientWidth / 2;
       }
       setTimeout(() => {
           if (containerRef.current) {
               containerRef.current.scrollLeft = startTarget;
           }
       }, 0);
       hasInitialScrolled.current = true;
    }

    const handleScrollStorage = () => {
       const centerPx = container.scrollLeft + container.clientWidth / 2;
       const centerTimeMs = minTime + (centerPx / zoomRef.current) * 3600000;
       localStorage.setItem('nexus_timeline_view', JSON.stringify({ centerTimeMs, savedZoom: zoomRef.current }));
    };
    
    // Add scroll listener with basic non-blocking behavior
    let timeoutId: NodeJS.Timeout;
    const scrollListener = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(handleScrollStorage, 250);
    };
    container.addEventListener('scroll', scrollListener, { passive: true });

    return () => {
        container.removeEventListener('wheel', handleWheel);
        container.removeEventListener('scroll', scrollListener);
    };
  }, [timelineItems.length, durationMs, minTime]);

  useLayoutEffect(() => {
    if (scrollTargetRef.current !== null && containerRef.current) {
        containerRef.current.scrollLeft = scrollTargetRef.current;
        scrollTargetRef.current = null;
    }
  });

  const keysPressed = useRef<{ up: boolean, down: boolean }>({ up: false, down: false });
  const rAFRef = useRef<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        if (e.key === 'ArrowUp') {
            keysPressed.current.up = true;
            e.preventDefault();
        }
        if (e.key === 'ArrowDown') {
            keysPressed.current.down = true;
            e.preventDefault();
        }
        startZoomLoop();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp') {
            keysPressed.current.up = false;
        }
        if (e.key === 'ArrowDown') {
            keysPressed.current.down = false;
        }
    };

    const startZoomLoop = () => {
        if (!rAFRef.current) {
            rAFRef.current = requestAnimationFrame(zoomLoop);
        }
    };

    const zoomLoop = () => {
        if (!keysPressed.current.up && !keysPressed.current.down) {
            rAFRef.current = null;
            return;
        }

        const container = containerRef.current;
        if (container) {
            const factor = keysPressed.current.up ? 1.03 : 0.97;
            
            const rect = container.getBoundingClientRect();
            const mouseX = rect.width / 2;

            let currentZoom = zoomRef.current;
            let startScrollLeft = scrollTargetRef.current !== null ? scrollTargetRef.current : container.scrollLeft;

            const currentTotalWidth = (durationMs / 3600000) * currentZoom;
            const maxScrollLeft = Math.max(0, currentTotalWidth - rect.width);
            startScrollLeft = Math.max(0, Math.min(startScrollLeft, maxScrollLeft));

            const mouseXInTimeline = startScrollLeft + mouseX;

            const newZoom = Math.max(0.1, Math.min(currentZoom * factor, 10000));
            const ratio = newZoom / currentZoom;
            let newScrollLeft = (mouseXInTimeline * ratio) - mouseX;
            
            const newTotalWidth = (durationMs / 3600000) * newZoom;
            const newMaxScrollLeft = Math.max(0, newTotalWidth - rect.width);
            newScrollLeft = Math.max(0, Math.min(newScrollLeft, newMaxScrollLeft));

            scrollTargetRef.current = newScrollLeft;
            zoomRef.current = newZoom;
            setZoom(newZoom);
        }

        rAFRef.current = requestAnimationFrame(zoomLoop);
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        if (rAFRef.current !== null) {
            cancelAnimationFrame(rAFRef.current);
            rAFRef.current = null;
        }
    };
  }, [durationMs]);

  const daysGrid = useMemo(() => {
    if (durationMs === 0) return [];
    const days = [];
    let currentStart = startOfDay(new Date(minTime));
    const end = new Date(maxTime);
    
    let index = 0;
    while (currentStart <= end) {
      const nextStart = addDays(currentStart, 1);
      
      const startMs = currentStart.getTime();
      const nextMs = nextStart.getTime();
      
      const leftPx = Math.max(0, getPosition(startMs));
      const rightPx = Math.min(totalWidth, getPosition(nextMs));
      const dayWidth = rightPx - leftPx;
      
      const isAlt = index % 2 === 0;
      const isMonday = getDay(currentStart) === 1;
      const isFirstOfMonth = isFirstDayOfMonth(currentStart);
      
      let borderClass = "border-l border-border/40 z-0";
      if (isFirstOfMonth) {
         borderClass = "border-l-[4px] border-primary/60 z-10";
      } else if (isMonday) {
         borderClass = "border-l-[2px] border-border/40 z-10";
      }

      if (dayWidth > 0) {
        days.push({
          id: startMs,
          leftPx,
          widthPx: dayWidth,
          isAlt,
          borderClass,
          label: format(currentStart, 'MMM d')
        });
      }
      
      currentStart = nextStart;
      index++;
    }
    return days;
  }, [minTime, maxTime, durationMs, totalWidth, getPosition]);

  const hoursGrid = useMemo(() => {
    if (durationMs === 0 || zoom < 80) return [];
    const hours = [];
    let current = new Date(minTime);
    current.setMinutes(0, 0, 0);
    const end = new Date(maxTime);
    
    while (current <= end) {
      const timeMs = current.getTime();
      const leftPx = getPosition(timeMs);
      if (leftPx >= 0 && leftPx <= totalWidth) {
        // Only show if it's not exactly at the day boundary (which is handled by daysGrid)
        if (current.getHours() !== 0) {
          hours.push({
            id: timeMs,
            leftPx,
            label: format(current, 'HH:00')
          });
        }
      }
      current = new Date(timeMs + 3600000);
    }
    return hours;
  }, [minTime, maxTime, durationMs, totalWidth, getPosition, zoom]);

  return (
    <div className="w-full h-full bg-background flex flex-col font-mono text-sm max-h-full">
      <div className="p-4 shrink-0 border-b border-border/40 flex justify-between items-center bg-muted/10">
         <div className="flex items-center gap-4">
            <h2 className="text-xl uppercase tracking-widest text-primary font-bold">Timeline</h2>
            <span className="text-[10px] text-muted-foreground uppercase opacity-80">(Wheel to zoom. Shift+Wheel or Trackpad to pan)</span>
         </div>
         <div className="flex flex-wrap items-center gap-4">
            {Object.keys(graphData).length > 0 && (
              <div className="flex items-center gap-4">
                 {Object.keys(graphData).map(cat => (
                   <div key={cat} className="flex items-center gap-1.5 bg-background border border-border/40 p-1 px-2">
                     <span className="text-[10px] font-mono text-muted-foreground uppercase">{cat}</span>
                     <div className="flex items-center gap-1">
                       <button 
                         onClick={() => updateColor(cat, graphColors[cat] === 'dynamic' ? '#ffffff' : 'dynamic')}
                         className={`px-1 h-4 flex items-center justify-center text-[9px] font-mono uppercase transition-colors border ${graphColors[cat] === 'dynamic' ? 'bg-primary/20 border-primary/50 text-primary' : 'border-border/40 text-muted-foreground hover:bg-muted'}`}
                         title="Dynamic color mapping"
                       >
                         Dyn
                       </button>
                       {graphColors[cat] !== 'dynamic' && (
                         <input 
                           type="color" 
                           title="Solid color"
                           value={graphColors[cat] || '#ffffff'} 
                           onChange={(e) => updateColor(cat, e.target.value)}
                           className="w-4 h-4 p-0 border-0 cursor-pointer bg-transparent"
                         />
                       )}
                     </div>
                   </div>
                 ))}
              </div>
            )}
            <span className="text-muted-foreground text-xs uppercase opacity-80">{timelineItems.length} Events</span>
         </div>
      </div>
      
      <div 
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar relative"
      >
        {timelineItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm uppercase tracking-widest">
            No timeline events found.
          </div>
        ) : (
          <div className="relative h-full flex items-center min-w-full" style={{ width: `${totalWidth}px` }}>

             {/* Background Grid */}
             <div className="absolute inset-0 flex pointer-events-none">
                {daysGrid.map(day => {
                   const hourWidth = day.widthPx / 24;
                   let bgStyle: any = { left: `${day.leftPx}px`, width: `${day.widthPx}px` };
                   if (zoom >= 15 && zoom < 80) { // Only use SVG when not high zoom (where we use real elements)
                      const svgWidth = Math.max(1, hourWidth);
                      const encodedSvg = `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${svgWidth}' height='100%25'%3E%3Cline x1='0.5' y1='0' x2='0.5' y2='100%25' stroke='gray' stroke-opacity='0.2' stroke-width='1' stroke-dasharray='4,4'/%3E%3C/svg%3E`;
                      bgStyle.backgroundImage = `url("${encodedSvg}")`;
                      bgStyle.backgroundSize = `${svgWidth}px 100%`;
                      bgStyle.backgroundRepeat = 'repeat-x';
                      bgStyle.backgroundPosition = `0 0`;
                   }

                   return (
                   <div 
                     key={day.id} 
                     className={`h-full absolute top-0 bottom-0 flex items-end ${day.isAlt ? 'bg-primary/5' : ''} ${day.borderClass}`}
                     style={bgStyle}
                   >
                     <div className="sticky left-2 mb-2 text-base font-normal text-white bg-black/80 backdrop-blur-md px-2 py-1 rounded shadow-xl select-none break-keep whitespace-nowrap z-50">
                       {day.label}
                     </div>
                   </div>
                   );
                })}

                {hoursGrid.map(hour => (
                   <div 
                     key={hour.id} 
                     className="h-full absolute top-0 w-px border-l border-white/20 border-dashed z-0 flex items-end"
                     style={{ left: `${hour.leftPx}px` }}
                   >
                     <div className="sticky left-1 mb-8 text-base font-normal text-white bg-black/80 backdrop-blur-md px-2 py-1 rounded shadow-xl uppercase leading-none whitespace-nowrap select-none z-50">
                       {hour.label}
                     </div>
                   </div>
                ))}
             </div>

             {/* Red Line for Now */}
             <div 
               className="absolute top-0 bottom-0 w-px bg-red-600 z-50 pointer-events-none"
               style={{ left: `${getPosition(now)}px` }}
             >
               <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-600" />
             </div>

             {/* The horizontal midline */}
             <div className="absolute left-0 right-0 h-0.5 bg-border/40 z-10" />

             {/* Graph Data Overlay */}
             <div className="absolute inset-0 pointer-events-none z-10">
               {Object.entries(graphData).map(([cat, points]) => {
                 const isMood = cat === 'Mood';
                 // Map Y logic:
                 // Mood: 10 -> 0%, 0 -> 50%, -10 -> 100%
                 // Others: 10 -> 0%, 0 -> 50%
                 
                 const mappedPoints = points.map(p => {
                    const x = getPosition(p.x);
                    let y = 0;
                    if (isMood) {
                       y = containerHeight * (0.5 - (p.y / 20)); // -10..10 maps to 1..0
                    } else {
                       y = containerHeight * (0.5 - (p.y / 20)); // 0..10 maps to 0.5..0
                    }
                    return { x, y, rawY: p.y, original: p };
                 });

                 const isDynamic = graphColors[cat] === 'dynamic';

                 return (
                   <svg key={cat} className="absolute inset-0" width={totalWidth} height={containerHeight}>
                     {isDynamic && (
                        <defs>
                           <linearGradient id={`${cat}-grad`} x1="0" y1="0" x2="0" y2="100%" gradientUnits="userSpaceOnUse">
                              {isMood ? (
                                <>
                                  <stop offset="0%" stopColor="#22c55e" stopOpacity="1" />
                                  <stop offset="50%" stopColor="#22c55e" stopOpacity="0" />
                                  <stop offset="75%" stopColor="#eab308" stopOpacity="0.5" />
                                  <stop offset="100%" stopColor="#ef4444" stopOpacity="1" />
                                </>
                              ) : (
                                <>
                                  <stop offset="0%" stopColor="#ef4444" />
                                  <stop offset="50%" stopColor="#eab308" />
                                  <stop offset="100%" stopColor="#22c55e" />
                                </>
                              )}
                           </linearGradient>
                        </defs>
                     )}
                     <path 
                       d={smoothPath(mappedPoints)} 
                       fill="none" 
                       stroke={isDynamic ? `url(#${cat}-grad)` : (graphColors[cat] || '#ffffff')}
                       strokeWidth="4" 
                       strokeLinecap="round" 
                       strokeLinejoin="round" 
                       className="drop-shadow-sm opacity-80"
                     />
                   </svg>
                 );
               })}
             </div>

             {/* Sleep Segments */}
             {sleepSegments.map((seg, i) => {
                 const leftPx = getPosition(seg.start);
                 const rightPx = getPosition(seg.end);
                 const width = rightPx - leftPx;
                 return (
                   <div 
                     key={`sleep-${i}`} 
                     className="absolute top-1/2 -mt-[2px] h-[4px] bg-foreground z-30 opacity-90 rounded-full" 
                     style={{ left: `${leftPx}px`, width: `${width}px` }} 
                     title="Sleep"
                   />
                 );
             })}

             {itemsWithLanes.map(({ item, side, laneIdx }, idx) => {
                 const time = (item.loggedAt || item.createdAt)?.toMillis?.() || 0;
                 const leftPx = getPosition(time);
                 
                 const notes = item.notes?.trim().toLowerCase() || "";
                 const isSleep = notes === 'sleep';
                 const isWake = notes.startsWith('wake up');
                 const isSpecial = isSleep || isWake;

                 const d = (item.loggedAt || item.createdAt)?.toDate?.();
                 const offset = 70 + (laneIdx * 22); 

                 return (
                    <div 
                       key={item.id || idx} 
                       className={`absolute flex flex-col items-center ${side === 'top' ? 'bottom-1/2' : 'top-1/2'} z-20`}
                       style={{ 
                         left: `${leftPx}px`, 
                         transform: `translateX(-50%)`
                       }}
                    >
                        {/* The connector and card group that offsets for stacking */}
                        {side === 'top' && (
                           <div 
                             className="flex flex-col items-center"
                             style={{ transform: `translateY(-${offset}px)` }}
                           >
                              <TimelineCard item={item} isSpecial={isSpecial} date={d} />
                              <div className="w-[1.5px] bg-white" style={{ height: `${offset + 12}px` }} />
                           </div>
                        )}
                        
                        {/* Dot - stays pinned to the midline */}
                        <div className={`w-2 h-2 rounded-full border border-background shadow-sm absolute ${side === 'top' ? '-bottom-1' : '-top-1'} ${isSpecial ? 'bg-primary' : 'bg-muted-foreground'} z-20 box-content`} />

                        {side === 'bottom' && (
                           <div 
                             className="flex flex-col items-center"
                             style={{ transform: `translateY(${offset}px)` }}
                           >
                              <div className="w-[1.5px] bg-white" style={{ height: `${offset + 12}px` }} />
                              <TimelineCard item={item} isSpecial={isSpecial} date={d} />
                           </div>
                        )}
                    </div>
                 );
             })}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineCard({ item, isSpecial, date }: { item: InventoryItem, isSpecial: boolean, date: Date | undefined }) {
  const notes = item.notes?.trim().toLowerCase() || "";
  const isSleep = notes === 'sleep';
  const isWake = notes.startsWith('wake up');
  
  const displayName = isSleep ? 'Sleep' : isWake ? 'Wake up' : (item.category || '(No Item)');
  const hasIcon = !!item.icon;

  return (
    <div className="flex flex-col gap-1 w-40 items-center text-center group cursor-default">
      <div className={`p-0.5 border w-full shrink-0 shadow-sm transition-all hover:border-primary/50 relative z-10 ${isSpecial ? 'border-primary/50 bg-primary/10' : 'border-border/40 bg-background/90 backdrop-blur-sm'}`}>
        <div className="font-bold flex items-center justify-center gap-1 text-center min-h-[24px]">
          {item.icon ? (
            item.icon.startsWith('http') || item.icon.startsWith('data:image') ? (
              <img src={item.icon} alt={displayName} className="w-4 h-4 object-contain inline-block" />
            ) : (
              <span className="text-base">{item.icon}</span>
            )
          ) : (
            <span className="truncate uppercase tracking-tight text-[9px] leading-tight font-bold px-1">{displayName}</span>
          )}
          
          {(item.quantity !== undefined && item.quantity !== 0 && !isSpecial) && (
            <span className="opacity-80 text-[9px] shrink-0 font-mono">
              {item.quantity}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
