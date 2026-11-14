export const MotionPresets = [
  { id: "auto", label: "自动分配", supports: () => true },
  { id: "none", label: "无动画", supports: () => true },
  { id: "typewriter", label: "逐字揭示", supports: (block) => typeof block.content === "string" || Array.isArray(block.content) },
  { id: "cursor-build", label: "光标搭建", supports: () => true, frames: () => [{ clipPath: "inset(0 100% 0 0)", opacity: 0.3 }, { clipPath: "inset(0 0% 0 0)", opacity: 1 }] },
  { id: "fade", label: "淡入", supports: () => true, frames: () => [{ opacity: 0 }, { opacity: 1 }] },
  { id: "rise", label: "向上浮现", supports: () => true, frames: () => [{ opacity: 0, transform: "translateY(22px)" }, { opacity: 1, transform: "translateY(0)" }] },
  { id: "scale", label: "缩放出现", supports: () => true, frames: () => [{ opacity: 0, transform: "scale(.94)" }, { opacity: 1, transform: "scale(1)" }] },
  { id: "custom", label: "自定义关键帧", supports: () => true, frames: (config) => config.keyframes },
];

export function resolvePreset(block, config) {
  const requested = config.preset === "auto"
    ? MotionPresets.find((preset) => preset.id === "typewriter").supports(block) ? "typewriter" : "cursor-build"
    : config.preset;
  const preset = MotionPresets.find((item) => item.id === requested);
  if (!preset) throw new Error(`未注册的动画：${requested}`);
  if (!preset.supports(block)) throw new Error(`“${preset.label}”与当前区块类型不匹配`);
  return preset;
}
