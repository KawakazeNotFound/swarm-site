import { GuideColor, RulerThickness } from "../scene/Theme.js";
function Rulers({ engine }) {
  const opacity = engine.rulers.opacity;
  if (opacity <= 0.001) {
    return null;
  }
  const { scale, left, width: viewportWidth, height: viewportHeight, scrollY } = engine.viewport;
  const tickStep = scale > 0.6 ? 100 : scale > 0.3 ? 200 : 500;
  const horizontalTicks = [];
  const verticalTicks = [];
  const firstHorizontalTick = Math.floor(-left / scale / tickStep) * tickStep;
  for (
    let position = firstHorizontalTick;
    left + position * scale < viewportWidth;
    position += tickStep / 2
  ) {
    const screenX = left + position * scale;
    const majorTick = position % tickStep === 0;
    horizontalTicks.push(
      <line
        x1={screenX}
        x2={screenX}
        y1={majorTick ? 13 : 16}
        y2={RulerThickness}
        stroke="#5E5E5E"
        key={"t" + position}
      />,
    );
    if (majorTick) {
      horizontalTicks.push(
        <text x={screenX + 3} y={11} className="rtext" key={"l" + position}>
          {position}
        </text>,
      );
    }
  }
  const firstVerticalTick = Math.floor(scrollY / scale / tickStep) * tickStep;
  for (
    let position = firstVerticalTick;
    position * scale - scrollY < viewportHeight;
    position += tickStep / 2
  ) {
    const screenY = position * scale - scrollY;
    const majorTick = position % tickStep === 0;
    verticalTicks.push(
      <line
        y1={screenY}
        y2={screenY}
        x1={majorTick ? 13 : 16}
        x2={RulerThickness}
        stroke="#5E5E5E"
        key={"t" + position}
      />,
    );
    if (majorTick) {
      verticalTicks.push(
        <text
          x={11}
          y={screenY - 3}
          className="rtext"
          transform={`rotate(-90 11 ${screenY - 3})`}
          key={"l" + position}
        >
          {position}
        </text>,
      );
    }
  }
  for (const cursor of engine.cursors) {
    if (cursor.overlay) {
      for (const overlay of cursor.overlay()) {
        if (overlay.t !== "box" || !overlay.handles) {
          continue;
        }
        const selectionLeft = left + overlay.b.x * scale;
        const selectionRight = left + (overlay.b.x + overlay.b.w) * scale;
        const selectionTop = overlay.b.y * scale - scrollY;
        const selectionBottom = (overlay.b.y + overlay.b.h) * scale - scrollY;
        horizontalTicks.unshift(
          <rect
            x={selectionLeft}
            y={0}
            width={selectionRight - selectionLeft}
            height={RulerThickness}
            fill="rgba(13,153,255,0.22)"
            key={"s" + cursor.id}
          />,
        );
        horizontalTicks.push(
          <text x={selectionLeft + 3} y={11} className="rtext rsel" key={"sa" + cursor.id}>
            {Math.round(overlay.b.x)}
          </text>,
        );
        verticalTicks.unshift(
          <rect
            y={selectionTop}
            x={0}
            height={selectionBottom - selectionTop}
            width={RulerThickness}
            fill="rgba(13,153,255,0.22)"
            key={"s" + cursor.id}
          />,
        );
      }
    }
  }
  for (const guide of engine.elementList) {
    if (!(guide.kind !== "guide" || !guide.dragging)) {
      if (guide.axis === "x") {
        const screenX = left + guide.current * scale;
        horizontalTicks.push(
          <line
            x1={screenX}
            x2={screenX}
            y1={0}
            y2={RulerThickness}
            stroke={GuideColor}
            key={"g" + guide.id}
          />,
        );
        horizontalTicks.push(
          <text x={screenX + 4} y={11} className="rtext" fill={GuideColor} key={"gl" + guide.id}>
            {Math.round(guide.current)}
          </text>,
        );
      } else {
        const screenY = guide.current * scale - scrollY;
        verticalTicks.push(
          <line
            y1={screenY}
            y2={screenY}
            x1={0}
            x2={RulerThickness}
            stroke={GuideColor}
            key={"g" + guide.id}
          />,
        );
      }
    }
  }
  return (
    <>
      <div
        className="ruler ruler-top"
        style={{
          transform: `translateY(${(opacity - 1) * 100}%)`,
        }}
      >
        <svg width={viewportWidth} height={RulerThickness}>
          {horizontalTicks}
        </svg>
      </div>
      <div
        className="ruler ruler-left"
        style={{
          transform: `translateX(${(opacity - 1) * 100}%)`,
        }}
      >
        <svg width={RulerThickness} height={viewportHeight}>
          {verticalTicks}
        </svg>
      </div>
      <div
        className="ruler-corner"
        style={{
          opacity,
        }}
      />
    </>
  );
}
export { Rulers };
