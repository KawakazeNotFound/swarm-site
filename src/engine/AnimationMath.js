const randomBetween = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const easeInOutCubic = (progress) =>
  progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
const easeOutCubic = (progress) => 1 - Math.pow(1 - progress, 3);
const touchElement = (element) => {
  element.revision++;
};
export { randomBetween, clamp, easeInOutCubic, easeOutCubic, touchElement };
