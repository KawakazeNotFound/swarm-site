const CursorHotspots = {
  arrow: [5, 3.5],
  dup: [5, 3.5],
  pen: [3, 3],
  "pen-add": [3, 3],
  "pen-close": [3, 3],
  cross: [12, 12],
  ibeam: [12, 12],
  ew: [12, 12],
  ns: [12, 12],
};
const ArrowPath =
  "M4.6 3.9 C4.2 3.1 4.9 2.4 5.7 2.8 L20.6 9.4 C21.5 9.8 21.4 11.1 20.4 11.3 L13.9 12.9 C13.4 13 13 13.4 12.9 13.9 L11.3 20.4 C11.1 21.4 9.8 21.5 9.4 20.6 Z";
function CursorShape({ shape, color }) {
  const outline = {
    stroke: "#fff",
    strokeWidth: 1.5,
    strokeLinejoin: "round",
  };
  switch (shape) {
    case "arrow":
      return <path d={ArrowPath} fill={color} {...outline} />;
    case "dup":
      return (
        <>
          <path
            d={ArrowPath}
            transform="translate(4 3.5)"
            fill="#fff"
            stroke={color}
            strokeWidth={1.3}
            strokeLinejoin="round"
          />
          <path d={ArrowPath} fill={color} {...outline} />
        </>
      );
    case "pen":
    case "pen-add":
    case "pen-close":
      return (
        <>
          <path d="M17.4 10.6 L20.6 13.8 L13.8 20.6 L10.6 17.4 Z" fill={color} {...outline} />
          <path d="M3 3 L13.1 6.3 L17.4 10.6 L10.6 17.4 L6.3 13.1 Z" fill={color} {...outline} />
          <path d="M3.6 3.6 L8.9 8.9" stroke="#fff" strokeWidth={1.2} strokeLinecap="round" />
          <circle cx={10.2} cy={10.2} r={1.75} fill="none" stroke="#fff" strokeWidth={1.2} />
          {shape === "pen-add" && (
            <g strokeLinecap="round">
              <path d="M23 19.5 V26.5 M19.5 23 H26.5" stroke="#fff" strokeWidth={3.4} />
              <path d="M23 19.5 V26.5 M19.5 23 H26.5" stroke="#1E1E1E" strokeWidth={1.3} />
            </g>
          )}
          {shape === "pen-close" && (
            <>
              <circle cx={23} cy={23} r={2.8} fill="none" stroke="#fff" strokeWidth={3.2} />
              <circle cx={23} cy={23} r={2.8} fill="none" stroke="#1E1E1E" strokeWidth={1.2} />
            </>
          )}
        </>
      );
    case "cross":
      return (
        <g strokeLinecap="round">
          <path d="M12 3.5 V20.5 M3.5 12 H20.5" stroke="#fff" strokeWidth={3.6} />
          <path d="M12 3.5 V20.5 M3.5 12 H20.5" stroke={color} strokeWidth={1.5} />
        </g>
      );
    case "ibeam": {
      const beamPath =
        "M8.5 4.5 H10.5 Q12 4.5 12 6 Q12 4.5 13.5 4.5 H15.5 M12 6 V18 M8.5 19.5 H10.5 Q12 19.5 12 18 Q12 19.5 13.5 19.5 H15.5";
      return (
        <g fill="none" strokeLinecap="round">
          <path d={beamPath} stroke="#fff" strokeWidth={3.6} />
          <path d={beamPath} stroke={color} strokeWidth={1.5} />
        </g>
      );
    }
    case "ew":
    case "ns":
      return (
        <path
          d="M2.5 12 L7 7.5 V10.4 H17 V7.5 L21.5 12 L17 16.5 V13.6 H7 V16.5 Z"
          transform={shape === "ns" ? "rotate(90 12 12)" : undefined}
          fill={color}
          {...outline}
        />
      );
  }
}
function Cursor({ cursor, screenX, screenY }) {
  const [hotspotX, hotspotY] = CursorHotspots[cursor.shape];
  const pressScale = 1 - cursor.press * 0.12;
  return (
    <div
      className="cursor"
      style={{
        transform: `translate(${screenX}px, ${screenY}px)`,
      }}
    >
      <svg
        width={28}
        height={28}
        viewBox="0 0 28 28"
        style={{
          transform: `translate(${-hotspotX}px, ${-hotspotY}px) rotate(${cursor.angle}deg) scale(${pressScale})`,
          transformOrigin: `${hotspotX}px ${hotspotY}px`,
        }}
      >
        <CursorShape shape={cursor.shape} color={cursor.color} />
      </svg>
    </div>
  );
}
export { CursorHotspots, ArrowPath, CursorShape, Cursor };
