import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, useScroll, useTransform } from 'motion/react';
import gsap from 'gsap';
import ScrollReveal from './components/ScrollReveal';
import ModelViewer from './components/ModelViewer';
import GoogleModelViewer from './components/GoogleModelViewer';

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function NavItem({ text }: { text: string }) {
  const [cycle, setCycle] = useState(0);

  return (
    <a 
      href="#" 
      className="relative overflow-hidden group flex items-center justify-center py-1"
      onMouseEnter={() => setCycle(c => c + 1)}
      onMouseLeave={() => setCycle(c => c + 1)}
    >
      {cycle === 0 ? (
        <span className="block text-white/64 group-hover:text-white transition-colors duration-300">
          {text}
        </span>
      ) : (
        <React.Fragment key={cycle}>
          <span className="block text-white/64 group-hover:text-white transition-colors duration-300 animate-fly-out-up">
            {text}
          </span>
          <span className="absolute block text-white/64 group-hover:text-white transition-colors duration-300 animate-fly-in-up">
            {text}
          </span>
        </React.Fragment>
      )}
    </a>
  );
}

const TOTAL_FRAMES = 272;
const ZOOM_FACTOR = 1.35;

export default function App() {
  const [arrowCycle, setArrowCycle] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadedProgress, setLoadedProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef(0);
  const requestRef = useRef<number>();

  const screen3Ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const { scrollYProgress: screen3Progress } = useScroll({
    target: screen3Ref,
    offset: ["start end", "start start"]
  });

  // Header animation: start moving up after screen 1
  const headerY = useTransform(scrollY, [0, 500, 800], [0, 0, -150]);

  // Finish flattening when it's 80% of the way to the top
  const rotateX = useTransform(screen3Progress, [0, 0.8], [15, 0]);
  const y = useTransform(screen3Progress, [0, 0.8], [100, 0]);

  // Preload images
  useEffect(() => {
    let loadedCount = 0;
    const images: HTMLImageElement[] = [];

    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      const frameNumber = i.toString().padStart(3, '0');
      img.src = `/ezgif-frame-${frameNumber}.jpg`;
      
      const handleLoad = () => {
        loadedCount++;
        setLoadedProgress(Math.round((loadedCount / TOTAL_FRAMES) * 100));
        if (loadedCount === TOTAL_FRAMES) {
          imagesRef.current = images;
          setIsLoaded(true);
        }
      };
      
      img.onload = handleLoad;
      img.onerror = handleLoad; // Proceed even on error to not block
      images.push(img);
    }
  }, []);

  // Canvas drawing logic
  const drawFrame = (index: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const images = imagesRef.current;

    if (!canvas || !ctx || !images[index]) return;

    const img = images[index];

    // Set canvas dimensions to window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Calculate object-fit: cover with ZOOM_FACTOR
    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = img.width / img.height;

    let drawWidth = canvas.width;
    let drawHeight = canvas.height;
    let offsetX = 0;
    let offsetY = 0;

    if (canvasRatio > imgRatio) {
      drawHeight = canvas.width / imgRatio;
      offsetY = (canvas.height - drawHeight) / 2;
    } else {
      drawWidth = canvas.height * imgRatio;
      offsetX = (canvas.width - drawWidth) / 2;
    }

    // Apply zoom
    const zoomedWidth = drawWidth * ZOOM_FACTOR;
    const zoomedHeight = drawHeight * ZOOM_FACTOR;
    const zoomOffsetX = offsetX - (zoomedWidth - drawWidth) / 2;
    const zoomOffsetY = offsetY - (zoomedHeight - drawHeight) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, zoomOffsetX, zoomOffsetY, zoomedWidth, zoomedHeight);
  };

  // Scroll and Resize handling
  useEffect(() => {
    if (!isLoaded) return;

    // Initial draw
    drawFrame(0);

    const handleScroll = () => {
      if (!screen3Ref.current) return;
      
      const rect = screen3Ref.current.getBoundingClientRect();
      const absoluteTop = window.scrollY + rect.top;
      const stopScroll = Math.max(1, absoluteTop - (window.innerHeight * 0.2));
      
      const scrollFraction = Math.max(0, Math.min(1, window.scrollY / stopScroll));
      
      const frameIndex = Math.min(
        TOTAL_FRAMES - 1,
        Math.floor(scrollFraction * TOTAL_FRAMES)
      );

      if (frameIndex !== currentFrameRef.current) {
        currentFrameRef.current = frameIndex;
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        requestRef.current = requestAnimationFrame(() => drawFrame(frameIndex));
      }
    };

    const handleResize = () => {
      drawFrame(currentFrameRef.current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    
    // Trigger once
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isLoaded]);

  // Mouse Parallax
  useEffect(() => {
    if (!isLoaded || !canvasRef.current) return;

    const canvas = canvasRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20; // -10 to 10
      const y = (e.clientY / window.innerHeight - 0.5) * 20; // -10 to 10

      gsap.to(canvas, {
        x: -x,
        y: -y,
        duration: 0.5,
        ease: "power2.out"
      });
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isLoaded]);

  return (
    <>
      {/* Loading Overlay - Rendered ON TOP, not instead of, to prevent hydration errors */}
      {!isLoaded && (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-white font-sans z-50">
          <div className="text-[10px] font-mono tracking-widest mb-4 text-white/50">LOADING SEQUENCE</div>
          <div className="text-4xl font-mono">{loadedProgress}%</div>
          <div className="w-64 h-[1px] bg-white/10 mt-8 overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-300 ease-out"
              style={{ width: `${loadedProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="relative w-full bg-black text-white font-sans">
        {/* Fixed Background Canvas */}
        <div className="fixed top-0 left-0 w-full h-screen z-0 overflow-hidden bg-black">
          <canvas
            ref={canvasRef}
            className="w-full h-full will-change-transform"
            style={{ scale: 1.05 }}
          />
          {/* Overlay gradient for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/60 pointer-events-none" />
        </div>

      {/* Fixed Header */}
      <motion.header 
        style={{ y: headerY }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-1/2 -translate-x-1/2 z-20 w-[90%] flex items-center justify-between pointer-events-auto py-4 md:py-6 lg:py-8"
      >
          {/* Logo */}
          <div className="flex items-center">
            <svg width="157" height="25" viewBox="0 0 157 25" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M138.266 0.5L124.266 24.5H127.766L130.766 19L132.266 16.5L140.266 2.5L148.266 16.5L149.766 19L152.766 24.5H156.266L142.266 0.5H138.266Z" fill="white"/>
              <path d="M108.344 17.5625C108.344 16.6354 108.271 15.9062 108.125 15.375C107.979 14.8438 107.651 14.4531 107.141 14.2031C106.63 13.9427 105.839 13.776 104.766 13.7031C103.693 13.6198 102.224 13.5625 100.359 13.5312L91.6719 13.4062C89.526 13.375 87.8021 13.2448 86.5 13.0156C85.1979 12.7865 84.2135 12.4271 83.5469 11.9375C82.8802 11.4375 82.4323 10.7708 82.2031 9.9375C81.9844 9.10417 81.875 8.0625 81.875 6.8125C81.875 5.44792 82.026 4.32292 82.3281 3.4375C82.6406 2.55208 83.1979 1.85938 84 1.35938C84.8125 0.859375 85.9583 0.510417 87.4375 0.3125C88.9167 0.104167 90.8281 0 93.1719 0H99.8594C101.984 0 103.755 0.0677083 105.172 0.203125C106.589 0.338542 107.714 0.651042 108.547 1.14062C109.38 1.63021 109.974 2.39062 110.328 3.42188C110.693 4.45312 110.875 5.86979 110.875 7.67188H107.875C107.875 6.27604 107.74 5.22396 107.469 4.51562C107.208 3.79688 106.771 3.30729 106.156 3.04688C105.552 2.78646 104.734 2.64583 103.703 2.625C102.672 2.60417 101.391 2.59375 99.8594 2.59375H93.3281C91.4635 2.59375 89.9688 2.63021 88.8438 2.70312C87.7292 2.77604 86.8854 2.94271 86.3125 3.20312C85.7396 3.46354 85.3542 3.88021 85.1562 4.45312C84.9688 5.02604 84.875 5.8125 84.875 6.8125C84.875 7.65625 84.9427 8.33333 85.0781 8.84375C85.2135 9.35417 85.5156 9.74479 85.9844 10.0156C86.4635 10.276 87.1979 10.4583 88.1875 10.5625C89.1771 10.6562 90.526 10.7135 92.2344 10.7344L101.547 10.8594C103.734 10.8906 105.479 11.0208 106.781 11.25C108.094 11.4688 109.073 11.8281 109.719 12.3281C110.375 12.8281 110.807 13.5052 111.016 14.3594C111.234 15.2031 111.344 16.2708 111.344 17.5625C111.344 18.9688 111.208 20.151 110.938 21.1094C110.677 22.0573 110.167 22.8177 109.406 23.3906C108.646 23.9635 107.547 24.375 106.109 24.625C104.672 24.875 102.781 25 100.438 25H93.125C90.9896 25 89.1979 24.9062 87.75 24.7188C86.3021 24.5312 85.1458 24.1562 84.2812 23.5938C83.4271 23.0208 82.8125 22.1719 82.4375 21.0469C82.0625 19.9219 81.875 18.4219 81.875 16.5469H84.875C84.875 18.0156 84.9948 19.151 85.2344 19.9531C85.474 20.7552 85.8906 21.3333 86.4844 21.6875C87.0885 22.0312 87.9271 22.2396 89 22.3125C90.0833 22.375 91.4583 22.4062 93.125 22.4062H100.281C102.146 22.4062 103.62 22.349 104.703 22.2344C105.786 22.1094 106.589 21.8802 107.109 21.5469C107.63 21.2031 107.964 20.7135 108.109 20.0781C108.266 19.4427 108.344 18.6042 108.344 17.5625Z" fill="white"/>
              <path d="M63.7969 24.5V0.5H66.7969V24.5H63.7969Z" fill="white"/>
              <path d="M11.7969 24.5L0 0.5H3.45312L13.7969 21.9531L23.5469 0.5H27.0469L36.7969 21.9531L43.7969 7.5H45.2969H46.7969L38.7969 24.5H34.7969L25.2969 3.51562L15.7969 24.5H11.7969Z" fill="white"/>
            </svg>
          </div>

          {/* Nav */}
          <nav className="hidden lg:flex items-stretch bg-[#1A1A1A]/40 backdrop-blur-[80px]">
            <div className="flex items-center justify-between px-6 font-mono text-xs tracking-[-0.01em] w-[480px]">
              <NavItem text="COMPANY" />
              <NavItem text="STATIONS" />
              <NavItem text="SERVICES" />
              <NavItem text="APPLICATIONS" />
              <NavItem text="CAREERS" />
            </div>
            <button className="bg-white text-black px-6 py-5 font-mono text-xs leading-4 font-bold tracking-[-0.01em] hover:bg-gray-200 transition-colors w-[148px]">
              CREATE MISSION
            </button>
          </nav>
        </motion.header>

      {/* Scrollable Content */}
      <div className="relative z-10 w-full pointer-events-none">
        
        {/* Screen 1 */}
        <div className="w-[90%] mx-auto h-screen flex flex-col py-8 md:py-12 lg:py-16 pb-12">
          <main className="flex-1 w-full pointer-events-auto flex flex-col md:grid md:grid-cols-12 md:grid-rows-[1fr_auto] gap-y-8 md:gap-y-0 md:gap-x-8">
            
            {/* Left Heading (Bottom Left on Desktop, Top on Mobile) */}
          <div className="md:row-start-2 md:col-start-1 md:col-span-8 flex items-end">
            <Reveal delay={0.2}>
              <h1 className="text-[clamp(2.5rem,6vw,5rem)] leading-[1.05] font-medium tracking-tight text-white whitespace-nowrap">
                Engineering<br />
                The Orbital Frontier
              </h1>
            </Reveal>
          </div>

          {/* Right Text Content (Center Right on Desktop) */}
          <div className="md:row-start-1 md:col-start-8 md:col-span-5 flex flex-col justify-center items-start md:items-end text-left md:text-right">
            <Reveal delay={0.3}>
              <p className="text-[clamp(1rem,1.6vw,1.375rem)] text-white/64 leading-[1.3] font-normal max-w-[460px]">
                Reliable construction and launch of commercial space stations for research, manufacturing, and tourism. <span className="font-semibold text-white">We make space accessible for your business.</span>
              </p>
            </Reveal>
          </div>

          {/* Right Button (Bottom Right on Desktop, Bottom on Mobile) */}
          <div className="md:row-start-2 md:col-start-8 md:col-span-5 flex items-end justify-start md:justify-end">
            <Reveal delay={0.4}>
              <div 
                className="flex items-stretch gap-1 group cursor-pointer"
                onMouseEnter={() => setArrowCycle(c => c + 1)}
                onMouseLeave={() => setArrowCycle(c => c + 1)}
              >
                {/* Text Button */}
                <div className="flex items-center px-8 py-5 bg-white/8 backdrop-blur-[80px] group-hover:bg-white transition-colors duration-300">
                  <span className="font-mono text-[12px] tracking-[-0.01em] text-white/90 group-hover:text-black transition-colors duration-300">
                    EXPLORE OUR STATIONS
                  </span>
                </div>
                {/* Arrow Button */}
                <div className="relative flex items-center justify-center px-6 bg-white/8 backdrop-blur-[80px] group-hover:bg-white transition-colors duration-300 overflow-hidden">
                  {arrowCycle === 0 ? (
                    <ArrowRight className="w-5 h-5 text-white/90 group-hover:text-black transition-colors duration-300" />
                  ) : (
                    <React.Fragment key={arrowCycle}>
                      <ArrowRight className="w-5 h-5 text-white/90 group-hover:text-black transition-colors duration-300 animate-fly-out" />
                      <ArrowRight className="absolute w-5 h-5 text-white/90 group-hover:text-black transition-colors duration-300 animate-fly-in" />
                    </React.Fragment>
                  )}
                </div>
              </div>
            </Reveal>
          </div>

          </main>
        </div>

        {/* Gap before Screen 2 */}
        <div className="h-[200px] w-full"></div>

        {/* Screen 2 */}
        <div className="w-[90%] mx-auto min-h-screen flex flex-col justify-center py-8 md:py-12 lg:py-16 pointer-events-auto">
          <div className="max-w-[1200px] w-full">
            <ScrollReveal
              baseOpacity={0.1}
              enableBlur={true}
              baseRotation={3}
              blurStrength={4}
              textClassName="text-[clamp(2rem,4.5vw,4rem)] leading-[1.1] font-medium tracking-tight text-white w-full"
            >
              Turnkey Orbital Solutions For Commercial Space Exploration. We Build The Infrastructure For Next-Generation Research, Manufacturing, And Space Tourism.
            </ScrollReveal>

            <div className="mt-24 grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8">
              {/* Col 1: Logo & Tagline */}
              <Reveal delay={0.1} className="md:col-span-4 flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <svg width="71" height="43" viewBox="0 0 71 43" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3.40966 14.0238C8.64285 10.3979 21.0085 7.85 35.4294 7.85C50.4091 7.85 63.1711 10.5992 68.025 14.45M67.4268 29.2762C62.1936 32.9021 49.8279 35.45 35.407 35.45C20.4273 35.45 7.66533 32.7008 2.81137 28.85M70.5 21.5C70.5 33.098 54.83 42.5 35.5 42.5C16.17 42.5 0.5 33.098 0.5 21.5M70.5 21.5C70.5 9.90202 54.83 0.5 35.5 0.5C16.17 0.5 0.5 9.90202 0.5 21.5M70.5 21.5H0.5M35.2009 42.5C48.4179 42.5 59.1325 33.098 59.1325 21.5C59.1325 9.90202 48.4179 0.5 35.2009 0.5C21.9838 0.5 11.2692 9.90202 11.2692 21.5C11.2692 33.098 21.9838 42.5 35.2009 42.5ZM35.2009 42.5V1.1M47.765 21.5C47.765 33.098 42.0059 42.5 34.9017 42.5C27.7975 42.5 22.0385 33.098 22.0385 21.5C22.0385 9.90202 27.7975 0.5 34.9017 0.5C42.0059 0.5 47.765 9.90202 47.765 21.5Z" stroke="white"/>
                  </svg>
                  <svg width="157" height="25" viewBox="0 0 157 25" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-auto">
                    <path fillRule="evenodd" clipRule="evenodd" d="M138.266 0.5L124.266 24.5H127.766L130.766 19L132.266 16.5L140.266 2.5L148.266 16.5L149.766 19L152.766 24.5H156.266L142.266 0.5H138.266Z" fill="white"/>
                    <path d="M108.344 17.5625C108.344 16.6354 108.271 15.9062 108.125 15.375C107.979 14.8438 107.651 14.4531 107.141 14.2031C106.63 13.9427 105.839 13.776 104.766 13.7031C103.693 13.6198 102.224 13.5625 100.359 13.5312L91.6719 13.4062C89.526 13.375 87.8021 13.2448 86.5 13.0156C85.1979 12.7865 84.2135 12.4271 83.5469 11.9375C82.8802 11.4375 82.4323 10.7708 82.2031 9.9375C81.9844 9.10417 81.875 8.0625 81.875 6.8125C81.875 5.44792 82.026 4.32292 82.3281 3.4375C82.6406 2.55208 83.1979 1.85938 84 1.35938C84.8125 0.859375 85.9583 0.510417 87.4375 0.3125C88.9167 0.104167 90.8281 0 93.1719 0H99.8594C101.984 0 103.755 0.0677083 105.172 0.203125C106.589 0.338542 107.714 0.651042 108.547 1.14062C109.38 1.63021 109.974 2.39062 110.328 3.42188C110.693 4.45312 110.875 5.86979 110.875 7.67188H107.875C107.875 6.27604 107.74 5.22396 107.469 4.51562C107.208 3.79688 106.771 3.30729 106.156 3.04688C105.552 2.78646 104.734 2.64583 103.703 2.625C102.672 2.60417 101.391 2.59375 99.8594 2.59375H93.3281C91.4635 2.59375 89.9688 2.63021 88.8438 2.70312C87.7292 2.77604 86.8854 2.94271 86.3125 3.20312C85.7396 3.46354 85.3542 3.88021 85.1562 4.45312C84.9688 5.02604 84.875 5.8125 84.875 6.8125C84.875 7.65625 84.9427 8.33333 85.0781 8.84375C85.2135 9.35417 85.5156 9.74479 85.9844 10.0156C86.4635 10.276 87.1979 10.4583 88.1875 10.5625C89.1771 10.6562 90.526 10.7135 92.2344 10.7344L101.547 10.8594C103.734 10.8906 105.479 11.0208 106.781 11.25C108.094 11.4688 109.073 11.8281 109.719 12.3281C110.375 12.8281 110.807 13.5052 111.016 14.3594C111.234 15.2031 111.344 16.2708 111.344 17.5625C111.344 18.9688 111.208 20.151 110.938 21.1094C110.677 22.0573 110.167 22.8177 109.406 23.3906C108.646 23.9635 107.547 24.375 106.109 24.625C104.672 24.875 102.781 25 100.438 25H93.125C90.9896 25 89.1979 24.9062 87.75 24.7188C86.3021 24.5312 85.1458 24.1562 84.2812 23.5938C83.4271 23.0208 82.8125 22.1719 82.4375 21.0469C82.0625 19.9219 81.875 18.4219 81.875 16.5469H84.875C84.875 18.0156 84.9948 19.151 85.2344 19.9531C85.474 20.7552 85.8906 21.3333 86.4844 21.6875C87.0885 22.0312 87.9271 22.2396 89 22.3125C90.0833 22.375 91.4583 22.4062 93.125 22.4062H100.281C102.146 22.4062 103.62 22.349 104.703 22.2344C105.786 22.1094 106.589 21.8802 107.109 21.5469C107.63 21.2031 107.964 20.7135 108.109 20.0781C108.266 19.4427 108.344 18.6042 108.344 17.5625Z" fill="white"/>
                    <path d="M63.7969 24.5V0.5H66.7969V24.5H63.7969Z" fill="white"/>
                    <path d="M11.7969 24.5L0 0.5H3.45312L13.7969 21.9531L23.5469 0.5H27.0469L36.7969 21.9531L43.7969 7.5H45.2969H46.7969L38.7969 24.5H34.7969L25.2969 3.51562L15.7969 24.5H11.7969Z" fill="white"/>
                  </svg>
                </div>
                <p className="text-[11px] font-mono tracking-widest text-white/60 uppercase leading-relaxed">
                  Shaping the future<br/>in orbit
                </p>
              </Reveal>

              {/* Col 2: Research */}
              <Reveal delay={0.2} className="md:col-span-4 flex flex-col gap-4">
                <h3 className="text-xl font-medium text-white">Microgravity Research<br/>Facilities</h3>
                <p className="text-[15px] text-white/80 leading-relaxed">
                  Unlock new possibilities for your R&D and manufacturing. Our advanced orbital labs provide the perfect zero-gravity environment for breakthrough discoveries.
                </p>
              </Reveal>

              {/* Col 3: Tourism */}
              <Reveal delay={0.3} className="md:col-span-4 flex flex-col gap-4">
                <h3 className="text-xl font-medium text-white">Commercial Space<br/>Tourism Habitats</h3>
                <p className="text-[15px] text-white/80 leading-relaxed">
                  Experience the ultimate journey. We build secure, comfortable, and fully equipped orbital habitats designed to provide an unforgettable experience for space travelers.
                </p>
              </Reveal>
            </div>
          </div>
        </div>

        {/* Gap before Screen 3 */}
        <div className="h-[200px] w-full"></div>

        {/* Screen 3 */}
        <div ref={screen3Ref} className="w-full h-[300vh] pointer-events-auto relative">
          <div className="sticky top-0 w-full h-screen flex items-center justify-center overflow-hidden" style={{ perspective: '1200px' }}>
            <motion.div 
              style={{ rotateX, y, transformOrigin: "bottom center" }}
              className="w-[80vw] h-[80vh] bg-[#1A1A1A]/40 backdrop-blur-[80px] border border-white/10 flex flex-col items-center justify-center p-8 relative"
            >
              {/* Top Left: Title & Subtitle */}
              <div className="absolute top-8 left-8 z-10 pointer-events-none flex flex-col gap-2">
                <h3 className="text-[18px] font-sans font-medium text-white uppercase tracking-wide">
                  Orbital Habitat V-1
                </h3>
                <p className="text-[12px] font-sans text-white/64 max-w-[300px]">
                  Commercial orbital outpost.
                </p>
              </div>

              {/* Top Right: Specs */}
              <div className="absolute top-8 right-8 z-10 pointer-events-none">
                <table className="font-mono text-[10px] text-white/80 border-separate border-spacing-x-4 border-spacing-y-1">
                  <tbody>
                    <tr>
                      <td className="text-right text-white/50">CREW:</td>
                      <td className="text-left font-medium text-white">4</td>
                    </tr>
                    <tr>
                      <td className="text-right text-white/50">HEIGHT:</td>
                      <td className="text-left font-medium text-white">10.1 M</td>
                    </tr>
                    <tr>
                      <td className="text-right text-white/50">HABITABLE VOLUME:</td>
                      <td className="text-left font-medium text-white">45 M³</td>
                    </tr>
                    <tr>
                      <td className="text-right text-white/50">PRESSURIZED VOLUME:</td>
                      <td className="text-left font-medium text-white">80 M³</td>
                    </tr>
                    <tr>
                      <td className="text-right text-white/50">MASS:</td>
                      <td className="text-left font-medium text-white">14,600 KG</td>
                    </tr>
                    <tr>
                      <td className="text-right text-white/50">POWER:</td>
                      <td className="text-left font-medium text-white">13,200 W</td>
                    </tr>
                    <tr>
                      <td className="text-right text-white/50">ORBIT:</td>
                      <td className="text-left font-medium text-white">51.6°, 425 KM</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="w-full h-full flex items-center justify-center">
                <GoogleModelViewer 
                  src="/122.glb"
                  autoRotate={true}
                  cameraControls={true}
                  shadowIntensity={0.5}
                  exposure={1}
                />
              </div>
            </motion.div>
          </div>
        </div>

      </div>
    </div>
    </>
  );
}
