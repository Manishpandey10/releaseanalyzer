import { Router } from "express";
import * as releaseController from "../controllers/release.controller.js";
import * as statementController from "../controllers/statement.controller.js";

const router = Router();

router.post("/demo", releaseController.generateDemoRelease);
router.post("/", releaseController.createRelease);
router.get("/", releaseController.getAllReleases);
router.get("/:id", releaseController.getReleaseById);
router.patch("/:id", releaseController.updateRelease);
router.post("/:id/finalize", releaseController.finalizeRelease);
router.post("/:id/analyze", releaseController.analyzeRelease);
router.get("/:id/analysis", releaseController.getAnalysis);
router.post("/:id/versions", releaseController.createVersion);
router.get("/:id/compare/:otherVersionId", releaseController.compareVersions);

router.get("/:id/statements", statementController.getStatements);
router.patch("/:id/statements/:statementId", statementController.updateStatement);
router.post("/:id/statements/:statementId/approve", statementController.approveStatement);
router.post("/:id/statements/:statementId/reject", statementController.rejectStatement);

export default router;
