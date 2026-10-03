import { aiAnalysisResponseSchema } from "./src/validation/ai.js";

const data = {
  impactAnalysis: [], missingInformation: [], unsupportedClaims: [], risks: [],
  internalStatements: [{ statement: "Test New", impact: "LOW", supportStatus: "SUPPORTED", evidenceIds: ["F-001"] }],
  clientStatements: []
};

const result = aiAnalysisResponseSchema.safeParse(data);
console.log(result.success ? "Success" : result.error);
