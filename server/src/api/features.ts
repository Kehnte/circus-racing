// features.ts — Public endpoint exposing enabled feature flags to the frontend.
import { Router, type Request, type Response } from "express";
import { FEATURES } from "../utils/features.js";

const router = Router();

// GET /api/features — no auth, called at app startup by the frontend
router.get("/", (_req: Request, res: Response) => {
  res.json({
    ocr:       FEATURES.OCR,
    streaming: FEATURES.STREAMING,
  });
});

export default router;
