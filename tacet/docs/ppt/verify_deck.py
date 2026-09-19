#!/usr/bin/env python3
"""Verify the generated deck: slide count, required template content, images,
and a geometric overflow check (does any text box exceed its slide bounds, or
is text likely to overflow its box height?)."""
import sys
from pathlib import Path

from pptx import Presentation
from pptx.util import Emu

DECK = Path(__file__).resolve().parent / "TACET_SIH26151_Idea_Submission.pptx"
SW, SH = 13.333, 7.5

REQUIRED = {
    0: ["SIH26151", "Dark Web Threat Actor De-Anonymization", "Blockchain & Cybersecurity",
        "Software", "KRMU159", "Tacet"],
    1: ["Proposed Solution", "Identity fragmentation", "Application-layer attribution"],
    2: ["Technical Approach", "node:sqlite", "scikit-learn", "Ingest offline dump"],
    3: ["Feasibility", "OPERATIONAL", "SCALABILITY", "Mitigation"],
    4: ["Impact", "BENEFIT MATRIX", "NTRO", "14 days"],
    5: ["Research", "ACM SAC", "NIST SP 800-86", "Bharatiya Sakshya"],
}

ok = True
prs = Presentation(str(DECK))
slides = list(prs.slides)
print(f"slides: {len(slides)}   size: {prs.slide_width.inches:.3f} x {prs.slide_height.inches:.3f} in")

if len(slides) < 6:
    print("FAIL: fewer than the 6 template slides"); ok = False

for idx, slide in enumerate(slides):
    texts = []
    pics = 0
    for sh in slide.shapes:
        if sh.shape_type == 13:
            pics += 1
        if sh.has_text_frame and sh.text_frame.text.strip():
            texts.append(sh.text_frame.text)
    blob = "\n".join(texts)

    for needle in REQUIRED.get(idx, []):
        if needle.lower() not in blob.lower():
            print(f"FAIL slide {idx+1}: missing required text '{needle}'"); ok = False

    # geometric checks
    for sh in slide.shapes:
        l = sh.left / 914400 if sh.left is not None else 0
        t = sh.top / 914400 if sh.top is not None else 0
        w = sh.width / 914400 if sh.width is not None else 0
        h = sh.height / 914400 if sh.height is not None else 0
        if l < -0.01 or t < -0.01 or l + w > SW + 0.01 or t + h > SH + 0.01:
            name = (sh.text_frame.text[:34].replace("\n", " ") if sh.has_text_frame else sh.shape_type)
            print(f"WARN slide {idx+1}: shape out of bounds  ({l:.2f},{t:.2f},{w:.2f}x{h:.2f})  {name!r}")

        # crude text-overflow heuristic for boxes: chars per line vs box height
        if sh.has_text_frame and sh.text_frame.text.strip():
            tf = sh.text_frame
            total_lines = 0
            for p in tf.paragraphs:
                txt = "".join(r.text for r in p.runs)
                if not txt:
                    continue
                size = max((r.font.size.pt for r in p.runs if r.font.size), default=11)
                # usable width in inches -> approx chars per line at this font size
                usable_w = max(w - 0.06, 0.4)
                cpl = max(int(usable_w * 96 / (size * 0.52)), 8)
                total_lines += max(1, -(-len(txt) // cpl))
                if p.line_spacing and isinstance(p.line_spacing, float):
                    pass
            if total_lines:
                line_h = 0.0212 * 1.06   # ~11pt line at 1.06 spacing, inches
                needed = total_lines * line_h
                if needed > h + 0.06:
                    print(f"WARN slide {idx+1}: text may overflow box (needs ~{needed:.2f}in, box {h:.2f}in) "
                          f"{tf.text[:40]!r}")
    print(f"  slide {idx+1}: {len(texts)} text shapes, {pics} images")

total_pics = sum(1 for s in slides for sh in s.shapes if sh.shape_type == 13)
print(f"images embedded: {total_pics}")
print("RESULT:", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
