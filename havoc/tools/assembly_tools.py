"""Layered Assembly Sequence — Docling + Gemini Vision.

Converts assembly instruction PDFs into a phase-by-phase robot sequence
(PHASE, PART_ID, ACTION, TARGET_LOCATION, TOOL).
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from config import settings

logger = logging.getLogger(__name__)


def process_layered_robotic_assembly(file_path: str | Path) -> list[dict]:
    """Extract layered assembly sequence from PDF using Docling + Gemini Vision.

    1. Docling: PDF → Markdown (Stückliste, tables)
    2. Upload PDF to Gemini Vision
    3. Gemini generates phase-by-phase sequence from visual layout
    4. Returns list of {PHASE, PART_ID, ACTION, TARGET_LOCATION, TOOL}
    """
    from google import genai

    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"Document not found: {file_path}")

    client = genai.Client(api_key=settings.google_api_key)

    # Step 1: Docling extract
    from tools.docling_tools import parse_document_full
    parsed = parse_document_full(file_path)
    document_markdown = parsed.markdown[:8000]

    # Step 2: Upload PDF for vision
    logger.info("Uploading %s to Gemini Files API...", file_path.name)
    uploaded = client.files.upload(file=str(file_path))
    logger.info("File uploaded, generating assembly sequence with %s...", settings.gemini_vision_model)

    # Step 3: Gemini Vision prompt
    prompt = f"""You are an expert robotics control engineer. You are provided with a visual PDF and its Docling-extracted Markdown text.

CRITICAL INSTRUCTION 1 - INVENTORY CHECKSUM:
Read the 'Stückliste' (Parts List) from the Markdown text. The exact 'Stück' (quantity) listed for every 'Artikel-Nr' MUST be used in your sequence. Do not leave any parts behind.

CRITICAL INSTRUCTION 2 - LAYERED ASSEMBLY LOGIC (ROW-BY-ROW):
Look visually at the 'Stationsbelegung' matrix in the PDF. The ROWS represent the chronological phases (layers) of assembly. Do NOT build this station-by-station.

Trace the visual grid from TOP row to BOTTOM row:
- Phase 0 (Row 1): Identify the part. Find every column (D-Seite, Station 1-16, U-Seite) with an 'X' or mark. Generate a step for each.
- Phase 1 (Row 2): Repeat for the next part.
- Continue row-by-row.

Output ONLY a strict JSON array of objects. No conversational text. No markdown code blocks.

If the document has a Stückliste/Parts List and Stationsbelegung matrix: use row-by-row phases.
If the document is a generic assembly instruction: extract steps in reading order (top-to-bottom, left-to-right).
Always return at least one step if any assembly info is present.

Format:
[
  {{"PHASE": 0, "PART_ID": "...", "ACTION": "PICK_AND_PLACE", "TARGET_LOCATION": "...", "TOOL": "GRIPPER"}},
  ...
]

Docling Text Reference:
{document_markdown}
"""

    response = client.models.generate_content(
        model=settings.gemini_vision_model,
        contents=[uploaded, prompt],
    )
    full_text = response.text or ""
    logger.info("Gemini response length: %d chars", len(full_text))

    # Step 4: Parse JSON
    try:
        if "```json" in full_text:
            json_part = full_text.split("```json")[1].split("```")[0].strip()
        else:
            start = full_text.find("[")
            end = full_text.rfind("]") + 1
            json_part = full_text[start:end] if start >= 0 and end > start else "[]"
        return json.loads(json_part)
    except json.JSONDecodeError as e:
        logger.warning("Assembly JSON parse failed: %s | raw: %s", e, full_text[:300])
        return [{"error": str(e), "raw_preview": full_text[:500]}]
