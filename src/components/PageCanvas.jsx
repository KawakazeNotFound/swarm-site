import { CanvasWidth } from "../scene/Theme.js";
import { SceneElements } from "./SceneElements.jsx";
function PageCanvas({ engine }) {
  const { scale, left } = engine.viewport;
  const elements = engine.elementList.filter((element) => !element.sticky);
  return (
    <div
      className="canvas"
      style={{
        width: CanvasWidth,
        height: engine.height,
        transform: `translateX(${left}px) scale(${scale})`,
      }}
    >
      <SceneElements elements={elements} height={engine.height} />
    </div>
  );
}
export { PageCanvas };
