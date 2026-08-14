import { parseIntero } from "../parse";

test("zero esplicito viene clampato al minimo, non sostituito dal fallback", () => {
  expect(parseIntero("0", { min: 2, max: 20, fallback: 8 })).toBe(2);
});

test("stringa vuota o non numerica usa il fallback", () => {
  expect(parseIntero("", { min: 2, max: 20, fallback: 8 })).toBe(8);
  expect(parseIntero("abc", { min: 2, max: 20, fallback: 8 })).toBe(8);
});

test("clamp su max e strip di caratteri spuri", () => {
  expect(parseIntero("500", { min: 1, max: 8, fallback: 4 })).toBe(8);
  expect(parseIntero("1.200", { min: 1, max: 5000, fallback: 500 })).toBe(1200);
  expect(parseIntero("07", { min: 1, max: 99, fallback: 1 })).toBe(7);
});
