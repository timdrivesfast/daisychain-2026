import path from "path";
import fs from "fs";
import { describe, beforeAll, test, expect } from "vitest";
import { buildFunction, getFunctionInfo, loadSchema, loadInputQuery, loadFixture, validateTestAssets, runFunction } from "@shopify/shopify-function-test-helpers";

describe("Referral Discount Function Tests", () => {
  let schema;
  let functionDir;
  let functionInfo;
  let schemaPath;
  let targeting;
  let functionRunnerPath;
  let wasmPath;

  beforeAll(async () => {
    functionDir = path.dirname(__dirname);
    await buildFunction(functionDir);
    functionInfo = await getFunctionInfo(functionDir);
    ({ schemaPath, functionRunnerPath, wasmPath, targeting } = functionInfo);
    schema = await loadSchema(schemaPath);
  }, 45000);

  const testCases = [
    {
      name: "applies discount when referral is validated and cart meets minimum",
      fixture: "referral-valid.json",
      shouldApplyDiscount: true,
      expectedDiscountPercentage: 10.0
    },
    {
      name: "does not apply discount when referral is not validated",
      fixture: "referral-not-validated.json",
      shouldApplyDiscount: false
    },
    {
      name: "does not apply discount when cart is below minimum order",
      fixture: "referral-below-minimum.json",
      shouldApplyDiscount: false
    },
    {
      name: "does not apply discount when metafield is missing",
      fixture: "referral-no-metafield.json",
      shouldApplyDiscount: false
    },
    {
      name: "does not apply discount when discount class is not ORDER",
      fixture: "referral-wrong-discount-class.json",
      shouldApplyDiscount: false
    }
  ];

  testCases.forEach(({ name, fixture, shouldApplyDiscount, expectedDiscountPercentage }) => {
    test(name, async () => {
      const fixtureFile = path.join(__dirname, "fixtures", fixture);
      const fixtureData = await loadFixture(fixtureFile);
      const targetInputQueryPath = targeting[fixtureData.target].inputQueryPath;
      const inputQueryAST = await loadInputQuery(targetInputQueryPath);

      // Validate the fixture matches the input query
      const validationResult = await validateTestAssets({ schema, fixture: fixtureData, inputQueryAST });
      expect(validationResult.inputQuery.errors).toEqual([]);
      expect(validationResult.inputFixture.errors).toEqual([]);
      expect(validationResult.outputFixture.errors).toEqual([]);

      // Run the function
      const runResult = await runFunction(
        fixtureData,
        functionRunnerPath,
        wasmPath,
        targetInputQueryPath,
        schemaPath
      );

      expect(runResult.error).toBeNull();

      if (shouldApplyDiscount) {
        // Should have one operation
        expect(runResult.result.output.operations).toHaveLength(1);
        
        const operation = runResult.result.output.operations[0];
        expect(operation).toHaveProperty("orderDiscountsAdd");
        
        const discountAdd = operation.orderDiscountsAdd;
        expect(discountAdd.candidates).toHaveLength(1);
        
        const candidate = discountAdd.candidates[0];
        expect(candidate.value.percentage.value).toBe(expectedDiscountPercentage.toString());
        expect(candidate.message).toContain("Referral discount");
        expect(candidate.targets[0]).toHaveProperty("orderSubtotal");
      } else {
        // Should have no operations
        expect(runResult.result.output.operations).toHaveLength(0);
      }
    }, 10000);
  });
});

