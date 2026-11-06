const CanvasWidth = 1280;
const ContentLeft = 80;
const ContentRight = 1200;
const LineStart = -1e4;
const LineEnd = 1e4;
const TextLeft = ContentLeft + 36;
const Colors = {
  ink: "#121417",
  muted: "#62666D",
  line: "#D7DADE",
  accent: "#4C5BD4",
  card: "#FFFFFF",
  code: "#131518",
};
const sansStyle = (size, weight, lineHeightRatio, color = Colors.ink, letterSpacing = 0) => ({
  font: "sans",
  size,
  weight,
  lineHeight: lineHeightRatio,
  color,
  letterSpacing,
});
const monoStyle = (size, color = Colors.muted, weight = 400, overrides = {}) => ({
  font: "mono",
  size,
  weight,
  lineHeight: 1.45,
  color,
  ...overrides,
});
const TextStyles = {
  h1: sansStyle(64, 600, 1.02, Colors.ink, -0.035),
  h2: sansStyle(40, 600, 1.08, Colors.ink, -0.03),
  h3: sansStyle(21, 600, 1.25, Colors.ink, -0.012),
  lead: sansStyle(19, 400, 1.5, Colors.muted, -0.005),
  body: sansStyle(15.5, 400, 1.55, Colors.muted),
  item: sansStyle(14.5, 450, 1.4, Colors.ink),
  nav: sansStyle(14, 500, 1.4, Colors.ink),
  btn: sansStyle(14.5, 600, 1.4, "#FFFFFF"),
  btnDark: sansStyle(14.5, 600, 1.4, Colors.ink),
  logo: sansStyle(19, 650, 1.3, "#43474E", -0.025),
  brand: sansStyle(18, 650, 1.3, Colors.ink, -0.02),
  stat: sansStyle(52, 600, 1, Colors.ink, -0.04),
  price: sansStyle(44, 600, 1.05, Colors.ink, -0.035),
  code: monoStyle(13.5, "#E0E2E5", 400, {
    lineHeight: 1.7,
    code: true,
    preformatted: true,
  }),
  codeDim: monoStyle(12, "#81868D"),
  nodeName: monoStyle(13, Colors.ink, 500),
  nodeWhite: monoStyle(14, "#FFFFFF", 500),
  small: monoStyle(12, Colors.muted),
};
const LogoPaths = [
  {
    d: "M0 61V70V95.5L16.16 87.6891C17.8793 86.8582 18.3949 84.6538 17.2227 83.1464L0 61Z",
    anchors: [
      [0, 61],
      [0, 95.5],
      [16.2, 87.7],
      [17.2, 83.1],
    ],
  },
  {
    d: "M120 79V70V45L103.54 52.3455C101.748 53.1452 101.194 55.4216 102.417 56.9557L120 79Z",
    anchors: [
      [120, 79],
      [120, 45],
      [103.5, 52.3],
      [102.4, 57],
    ],
  },
  {
    d: "M120 35V5C120 2.23858 117.761 0 115 0H35H20C8.95431 0 0 8.95432 0 20V50.9252L74.5897 101.343C76.2237 102.447 75.442 105 73.4697 105H0V135C0 137.761 2.23858 140 5 140H35H85H100C111.046 140 120 131.046 120 120V89.0748L45.4103 38.657C43.7763 37.5525 44.558 35 46.5303 35H120Z",
    anchors: [
      [120, 35],
      [120, 5],
      [115, 0],
      [20, 0],
      [5.9, 5.9],
      [0, 20],
      [0, 50.9],
      [74.6, 101.3],
      [73.5, 105],
      [0, 105],
      [0, 135],
      [5, 140],
      [100, 140],
      [114.1, 134.1],
      [120, 120],
      [120, 89.1],
      [45.4, 38.7],
      [46.5, 35],
    ],
  },
];
const SelectionColor = "#0D99FF";
const GuideColor = "#F24822";
const RulerThickness = 20;
const NavigationTop = 24;
const NavigationHeight = 64;
export {
  CanvasWidth,
  ContentLeft,
  ContentRight,
  LineStart,
  LineEnd,
  TextLeft,
  Colors,
  sansStyle,
  monoStyle,
  TextStyles,
  LogoPaths,
  SelectionColor,
  GuideColor,
  RulerThickness,
  NavigationTop,
  NavigationHeight,
};
