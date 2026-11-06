import { memo } from "react";
import { fontFamily, lineHeight } from "../scene/TextMetrics.js";
import { CanvasWidth } from "../scene/Theme.js";
function highlightCode(text) {
  if (text.trimStart().startsWith("#")) {
    return (
      <span
        style={{
          color: "#6B7078",
        }}
      >
        {text}
      </span>
    );
  }
  const tokens = [];
  const tokenPattern = /([A-Za-z_]+)(?=:)|([{}:,])|([^{}:,A-Za-z_]+|[A-Za-z_]+)/g;
  let match;
  let key = 0;
  let firstKey = true;
  for (; (match = tokenPattern.exec(text));) {
    if (match[1]) {
      tokens.push(
        <span
          style={{
            color: firstKey ? "#8FC9D6" : "#AEB6EE",
          }}
          key={key++}
        >
          {match[1]}
        </span>,
      );
      firstKey = false;
    } else {
      if (match[2]) {
        tokens.push(
          <span
            style={{
              color: "#81868D",
            }}
            key={key++}
          >
            {match[2]}
          </span>,
        );
      } else {
        tokens.push(match[3]);
      }
    }
  }
  return tokens;
}
const TextElement = memo(
  ({ element }) => {
    if (!element.visible) {
      return null;
    }
    const style = element.textStyle;
    const content = element.selectAll ? (
      <span className="text-sel">{element.displayedText}</span>
    ) : style.code ? (
      highlightCode(element.displayedText)
    ) : (
      element.displayedText
    );
    return (
      <div
        className="el-text"
        style={{
          left: element.x + element.dx,
          top: element.y + element.dy,
          width: element.w,
          whiteSpace: element.w != null && !style.preformatted ? "pre-wrap" : "pre",
          fontFamily: fontFamily(style),
          fontSize: element.size,
          fontWeight: style.weight,
          lineHeight: `${lineHeight(style, element.size)}px`,
          letterSpacing: `${style.letterSpacing ?? 0}em`,
          color: style.color,
          textAlign: element.align,
        }}
      >
        {content}
        {element.editing && !element.selectAll && (
          <span
            className="caret"
            style={{
              height: element.size * 1.15,
            }}
          />
        )}
      </div>
    );
  },
  (previous, next) => previous.revision === next.revision,
);
const RectangleElement = memo(
  ({ element }) => {
    if (!element.visible) {
      return null;
    }
    const width = element.draw?.w ?? element.w;
    const height = element.draw?.h ?? element.h;
    return (
      <div
        className="el-rect"
        style={{
          left: element.x + element.dx,
          top: element.y + element.dy,
          width,
          height,
          background: element.styled ? element.fill : "#D9D9D9",
          borderRadius: element.styled ? element.r : 0,
          boxShadow:
            element.styled && element.stroke ? `inset 0 0 0 1px ${element.stroke}` : "none",
        }}
      />
    );
  },
  (previous, next) => previous.revision === next.revision,
);
const PathElement = memo(
  ({ element }) => {
    if (!element.visible || element.placed === 0) {
      return null;
    }
    if (element.d && element.transform) {
      const progress = Math.min(1, (element.placed - 1) / element.points.length);
      return (
        <path
          d={element.d}
          transform={`translate(${element.transform.x} ${element.transform.y}) scale(${element.transform.scale})`}
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - progress}
          stroke={element.stroke}
          strokeWidth={1.2 / element.transform.scale}
          fill={element.fill}
          fillOpacity={element.fillVisible ? 1 : 0}
          style={{
            transition: "fill-opacity 220ms ease, stroke-dashoffset 120ms linear",
          }}
        />
      );
    }
    const pathData =
      element.points
        .slice(0, element.placed)
        .map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`)
        .join(" ") + (element.pathClosed ? " Z" : "");
    return (
      <path
        d={pathData}
        stroke={element.stroke}
        strokeWidth={element.strokeWidth}
        fill={element.fill ?? "none"}
        fillOpacity={element.fillVisible ? 1 : 0}
        style={{
          transition: "fill-opacity 220ms ease",
        }}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="miter"
        strokeLinecap="square"
      />
    );
  },
  (previous, next) => previous.revision === next.revision,
);
function SceneElements({ elements, height }) {
  return (
    <>
      {elements.map((element) =>
        element.kind === "rect" ? (
          <RectangleElement element={element} revision={element.revision} key={element.id} />
        ) : null,
      )}
      <svg className="paths" width={CanvasWidth} height={height}>
        {elements.map((element) =>
          element.kind === "path" ? (
            <PathElement element={element} revision={element.revision} key={element.id} />
          ) : null,
        )}
      </svg>
      {elements.map((element) =>
        element.kind === "text" ? (
          <TextElement element={element} revision={element.revision} key={element.id} />
        ) : null,
      )}
    </>
  );
}
export { highlightCode, TextElement, RectangleElement, PathElement, SceneElements };
