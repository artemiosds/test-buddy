import { describe, expect, it } from "vitest";
import { confirmHierarchySave } from "./confirm-hierarchy-save";

describe("hierarchy save confirmation", () => {
  it("confirms unit code 1.18.002 returned by the database", () => {
    expect(() => confirmHierarchySave({ id: "unit", codigo_hierarquico: "1.18.002" }, "1.18.002", "unit")).not.toThrow();
  });
  it("confirms sector code 1.18.002.001 returned by the database", () => {
    expect(() => confirmHierarchySave({ id: "sector", codigo_hierarquico: "1.18.002.001" }, "1.18.002.001", "sector")).not.toThrow();
  });
  it("rejects a zero-row update instead of reporting success", () => {
    expect(() => confirmHierarchySave(null, "1.18.002", "unit")).toThrow();
  });
  it("rejects a returned code different from the entered code", () => {
    expect(() => confirmHierarchySave({ id: "unit", codigo_hierarquico: null }, "1.18.002", "unit")).toThrow();
  });
  it("allows clearing a code for automatic sector numbering", () => {
    expect(() => confirmHierarchySave({ id: "sector", codigo_hierarquico: null }, null, "sector")).not.toThrow();
  });
  it("rejects confirmation from another record", () => {
    expect(() => confirmHierarchySave({ id: "other", codigo_hierarquico: "1.18.002" }, "1.18.002", "unit")).toThrow();
  });
});