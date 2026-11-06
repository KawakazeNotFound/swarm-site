import { useEffect, useState } from "react";
import { SwarmEngine } from "./engine/SwarmEngine.js";
import { CanvasWidth, Colors, LogoPaths } from "./scene/Theme.js";
import { StickyNavigation } from "./components/StickyNavigation.jsx";
import { PageCanvas } from "./components/PageCanvas.jsx";
import { SelectionOverlay } from "./components/SelectionOverlay.jsx";
import { CursorLayer } from "./components/CursorLayer.jsx";
import { Rulers } from "./components/Rulers.jsx";
function App() {
  const [engine, setEngine] = useState(null);
  const [, requestRender] = useState(0);
  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
    const fonts = [
      "400 16px Inter",
      "500 16px Inter",
      "600 16px Inter",
      '400 16px "JetBrains Mono"',
      '500 16px "JetBrains Mono"',
    ];
    const fontTimeout = new Promise((resolve) => setTimeout(resolve, 2500));
    Promise.race([Promise.all(fonts.map((font) => document.fonts.load(font))), fontTimeout]).then(
      () => setEngine(new SwarmEngine()),
    );
  }, []);
  useEffect(() => {
    if (!engine) {
      return;
    }
    const updateViewport = () => {
      const width = document.documentElement.clientWidth;
      const scale = Math.min(1, width / CanvasWidth);
      engine.viewport.width = width;
      engine.viewport.height = window.innerHeight;
      engine.viewport.scale = scale;
      engine.viewport.left = (width - CanvasWidth * scale) / 2;
    };
    window.swarm = engine;
    const handleScroll = () => engine.setScroll(window.scrollY);
    const handleWheel = () => {
      if (window.scrollY > 0) {
        engine.start();
      }
    };
    updateViewport();
    handleScroll();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });
    window.addEventListener("wheel", handleWheel, {
      passive: true,
    });
    const handlePointerMove = (event) => {
      engine.mouse = {
        x: event.clientX,
        y: event.clientY,
      };
    };
    const handlePointerLeave = () => {
      engine.mouse = null;
    };
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    document.documentElement.addEventListener("pointerleave", handlePointerLeave);
    let animationFrame = 0;
    let lastTime = performance.now();
    const animate = (time) => {
      engine.step((time - lastTime) / 1e3);
      lastTime = time;
      requestRender((revision) => revision + 1);
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [engine]);
  return engine ? (
    <>
      <div
        className="page"
        style={{
          height: engine.height * engine.viewport.scale,
        }}
      >
        <StickyNavigation engine={engine} />
        <PageCanvas engine={engine} />
        <div className={"intro-logo" + (engine.started ? " gone" : "")} aria-hidden={true}>
          <svg viewBox="0 0 120 140" width={60} height={70}>
            {LogoPaths.map((logoPath, index) => (
              <path d={logoPath.d} fill={Colors.line} key={index} />
            ))}
          </svg>
        </div>
        <SelectionOverlay engine={engine} />
        <CursorLayer engine={engine} />
      </div>
      <Rulers engine={engine} />
    </>
  ) : null;
}
export { App };
