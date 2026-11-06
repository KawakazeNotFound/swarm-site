import { GuideColor, RulerThickness, SelectionColor } from "../scene/Theme.js";
function SelectionOverlay({ engine }) {
  const { scale, left, width: viewportWidth, scrollY } = engine.viewport;
  const screenX = (x) => left + x * scale;
  const screenY = (y) => y * scale;
  const height = engine.height * scale;
  const shapes = [];
  const badges = [];
  let key = 0;
  for (const element of engine.elementList) {
    if (element.kind === "guide" && element.visible && element.opacity > 0) {
      const filter =
        element.flash > 0 ? `drop-shadow(0 0 ${2 + element.flash * 3}px ${GuideColor})` : undefined;
      const strokeWidth = 1 + element.flash;
      shapes.push(
        element.axis === "x" ? (
          <line
            x1={screenX(element.current)}
            x2={screenX(element.current)}
            y1={0}
            y2={height}
            stroke={GuideColor}
            strokeWidth={strokeWidth}
            opacity={element.opacity}
            style={{
              filter,
            }}
            key={key++}
          />
        ) : (
          <line
            x1={0}
            x2={viewportWidth}
            y1={screenY(element.current)}
            y2={screenY(element.current)}
            stroke={GuideColor}
            strokeWidth={strokeWidth}
            opacity={element.opacity}
            style={{
              filter,
            }}
            key={key++}
          />
        ),
      );
    }
    if (element.kind === "path" && element.editingPath) {
      const stickyOffset = element.sticky ? engine.stickyOffset : 0;
      const points = element.points.slice(0, element.placed).map((point) => ({
        x: screenX(point.x),
        y: screenY(point.y + stickyOffset),
      }));
      const owner =
        element.owner != null ? engine.cursors.find((cursor) => cursor.id === element.owner) : null;
      const previewPoints = [
        ...points,
        ...(owner
          ? [
              {
                x: screenX(owner.x),
                y: screenY(owner.y + stickyOffset),
              },
            ]
          : []),
      ];
      shapes.push(
        <polyline
          points={
            previewPoints.map((point) => `${point.x},${point.y}`).join(" ") +
            (element.pathClosed ? ` ${points[0].x},${points[0].y}` : "")
          }
          fill="none"
          stroke={SelectionColor}
          strokeWidth={1.5}
          key={key++}
        />,
      );
      points.forEach((point) =>
        shapes.push(
          <circle
            cx={point.x}
            cy={point.y}
            r={3.6}
            fill="#fff"
            stroke={SelectionColor}
            strokeWidth={1.5}
            key={key++}
          />,
        ),
      );
    }
  }
  const rulerOpacity = engine.rulers.opacity;
  for (const cursor of engine.cursors) {
    if (!cursor.overlay) {
      continue;
    }
    const cursorScreenY = (y) => (y + (cursor.sticky ? engine.stickyOffset : 0)) * scale;
    for (const overlay of cursor.overlay()) {
      if (overlay.t === "box") {
        const x = screenX(overlay.b.x);
        const y = cursorScreenY(overlay.b.y);
        const width = overlay.b.w * scale;
        const height = overlay.b.h * scale;
        const color = overlay.color === "red" ? GuideColor : SelectionColor;
        shapes.push(
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill="none"
            stroke={color}
            strokeWidth={1}
            key={key++}
          />,
        );
        if (overlay.underline && overlay.underline.w > 0) {
          const underline = overlay.underline;
          shapes.push(
            <line
              x1={screenX(underline.x)}
              x2={screenX(underline.x + underline.w)}
              y1={cursorScreenY(underline.y)}
              y2={cursorScreenY(underline.y)}
              stroke={SelectionColor}
              strokeWidth={1.5}
              key={key++}
            />,
          );
        }
        if (overlay.rulerLines && rulerOpacity > 0.05) {
          shapes.push(
            <g
              stroke={SelectionColor}
              strokeWidth={1}
              strokeDasharray="2 2"
              opacity={rulerOpacity}
              key={key++}
            >
              <line x1={RulerThickness} x2={x} y1={y + height / 2} y2={y + height / 2} />
              <line x1={x + width / 2} x2={x + width / 2} y1={scrollY + RulerThickness} y2={y} />
            </g>,
          );
        }
        if (overlay.handles)
          for (const [handleX, handleY] of [
            [x, y],
            [x + width, y],
            [x, y + height],
            [x + width, y + height],
          ]) {
            shapes.push(
              <rect
                x={handleX - 3.5}
                y={handleY - 3.5}
                width={7}
                height={7}
                fill="#fff"
                stroke={SelectionColor}
                strokeWidth={1}
                key={key++}
              />,
            );
          }
        if (overlay.badge && width > 0) {
          badges.push(
            <div
              className="badge"
              style={{
                left: x + width / 2,
                top: y + height + 8,
                background: color,
              }}
              key={key++}
            >
              {overlay.badge}
            </div>,
          );
        }
      } else {
        const start = {
          x: screenX(overlay.a.x),
          y: cursorScreenY(overlay.a.y),
        };
        const end = {
          x: screenX(overlay.b.x),
          y: cursorScreenY(overlay.b.y),
        };
        shapes.push(
          <line
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={GuideColor}
            strokeWidth={1}
            key={key++}
          />,
        );
        const horizontal = start.y === end.y;
        badges.push(
          <div
            className="badge"
            style={{
              left: horizontal ? (start.x + end.x) / 2 : start.x + 18,
              top: horizontal ? start.y + 8 : (start.y + end.y) / 2 - 9,
              background: GuideColor,
            }}
            key={key++}
          >
            {overlay.label}
          </div>,
        );
      }
    }
  }
  return (
    <div
      className="overlay"
      style={{
        height,
      }}
    >
      <svg width={viewportWidth} height={height}>
        {shapes}
      </svg>
      {badges}
    </div>
  );
}
export { SelectionOverlay };
