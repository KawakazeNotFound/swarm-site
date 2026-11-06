import { Cursor } from "./Cursor.jsx";
function CursorLayer({ engine }) {
  const { scale, left } = engine.viewport;
  return (
    <div
      className="cursors"
      style={{
        height: engine.height * scale,
      }}
    >
      {engine.cursors.map((cursor) => (
        <Cursor
          cursor={cursor}
          screenX={left + cursor.x * scale}
          screenY={(cursor.y + (cursor.sticky ? engine.stickyOffset : 0)) * scale}
          key={cursor.id}
        />
      ))}
    </div>
  );
}
export { CursorLayer };
