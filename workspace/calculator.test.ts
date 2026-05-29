import { describe, it, expect } from "bun:test";
import { add, divide } from "./calculator";

describe("add", () => {
  it("should return the sum of two numbers", () => {
    expect(add(1, 2)).toBe(3);
    expect(add(-5, 5)).toBe(0);
    expect(add(0, 0)).toBe(0);
  });
});

describe("divide", () => {
  it("should return the division of two numbers", () => {
    expect(divide(6, 3)).toBe(2);
    expect(divide(-10, 2)).toBe(-5);
  });

  it("should throw an error when dividing by zero", () => {
    expect(() => divide(5, 0)).toThrowError("Division by zero");
  });
});
