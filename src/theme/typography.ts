// DM Serif Display — заголовки и крупные числа (вечерняя книжная интонация);
// текст — системный.
export const fonts = {
  serif: "DMSerifDisplay_400Regular",
};

export const typography = {
  display: { fontSize: 34, fontFamily: fonts.serif, lineHeight: 42 },
  title: { fontSize: 23, fontFamily: fonts.serif, lineHeight: 30 },
  subtitle: { fontSize: 16, fontWeight: "600" as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: "600" as const, lineHeight: 18 },
  overline: { fontSize: 11, fontWeight: "700" as const, lineHeight: 14, letterSpacing: 1.1, textTransform: "uppercase" as const },
  number: { fontFamily: fonts.serif as string | undefined },
};
