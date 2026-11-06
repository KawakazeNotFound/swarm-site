import { CanvasWidth, NavigationHeight, NavigationTop, RulerThickness } from "../scene/Theme.js";
import { SceneElements } from "./SceneElements.jsx";
function StickyNavigation({ engine }) {
  const { scale, left } = engine.viewport;
  const elements = engine.elementList.filter((element) => element.sticky);
  const visible = elements.some((element) => element.visible);
  return (
    <div
      className="nav-sticky"
      style={{
        marginTop: NavigationTop * scale,
        height: NavigationHeight * scale,
        top: RulerThickness * engine.rulers.opacity,
      }}
    >
      {visible && <div className="nav-backdrop" />}
      <div
        className="nav-canvas"
        style={{
          width: CanvasWidth,
          transform: `translateX(${left}px) scale(${scale}) translateY(${-NavigationTop}px)`,
        }}
      >
        <SceneElements elements={elements} height={NavigationTop + NavigationHeight + 30} />
      </div>
    </div>
  );
}
export { StickyNavigation };
