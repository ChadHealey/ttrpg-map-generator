#!/usr/bin/env python3
"""Convert ADR-0025's vendored Alegreya source into the checked-in ASCII glyph pack."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

UNITS = 4096
SOURCE_SHA256 = "ba5564634b93a8f8ba57b48cd4f1ae7417d2b4656fbac779028679b00de3cf12"
SOURCE_BYTES = 425288
SOURCE_COMMIT = "40478177239cbf3bac07908ef0738afee0f72be7"
SOURCE_URL = "https://github.com/google/fonts/blob/40478177239cbf3bac07908ef0738afee0f72be7/ofl/alegreya/Alegreya%5Bwght%5D.ttf"
SOURCE_PATH = Path("packages/assets/glyph-packs/Alegreya[wght].ttf")
OUTPUT_PATH = Path("packages/assets/src/atlas-glyph-pack.ts")


def round_positive_half(value: float) -> int:
    return math.floor(value + 0.5)


class FlatteningPen(BasePen):
    def __init__(self, glyph_set, scale: float):
        super().__init__(glyph_set)
        self.scale = scale
        self.contours: list[list[tuple[int, int]]] = []
        self.current: list[tuple[int, int]] | None = None

    def _point(self, point):
        return (round_positive_half(point[0] * self.scale), round_positive_half(point[1] * self.scale))

    def _moveTo(self, point):
        self.current = [self._point(point)]

    def _lineTo(self, point):
        self._add(self._point(point))

    def _curveToOne(self, point1, point2, point3):
        raise ValueError("ADR-0025 source pack must contain only quadratic outlines.")

    def _qCurveToOne(self, control, end):
        start = self._getCurrentPoint()
        self._flatten(start, control, end)

    def _flatten(self, start, control, end):
        # The maximum quadratic deviation from the chord is <= half this control distance.
        deviation = distance_to_line(control, start, end)
        if deviation * self.scale <= 2:
            self._add(self._point(end))
            return
        left_start = start
        left_control = midpoint(start, control)
        middle = midpoint(left_control, midpoint(control, end))
        right_control = midpoint(control, end)
        self._flatten(left_start, left_control, middle)
        self._flatten(middle, right_control, end)

    def _closePath(self):
        self._finish()

    def _endPath(self):
        raise ValueError("ADR-0025 glyph contours must be closed.")

    def _add(self, point):
        if self.current is None:
            raise ValueError("Outline contained a segment without a contour.")
        if not self.current or self.current[-1] != point:
            self.current.append(point)

    def _finish(self):
        if self.current is None:
            raise ValueError("Outline closed without a contour.")
        points = self.current
        self.current = None
        if len(points) > 1 and points[0] == points[-1]:
            points.pop()
        if len(set(points)) < 3:
            raise ValueError("Outline contour has fewer than three distinct points.")
        if signed_area(points) == 0:
            raise ValueError("Outline contour has zero signed area.")
        if signed_area(points) > 0:
            points.reverse()
        self.contours.append(canonical_contour(points))


def midpoint(left, right):
    return ((left[0] + right[0]) / 2, (left[1] + right[1]) / 2)


def distance_to_line(point, left, right):
    dx = right[0] - left[0]
    dy = right[1] - left[1]
    if dx == 0 and dy == 0:
        return math.hypot(point[0] - left[0], point[1] - left[1])
    return abs(dy * point[0] - dx * point[1] + right[0] * left[1] - right[1] * left[0]) / math.hypot(dx, dy)


def signed_area(points):
    return sum(point[0] * points[(index + 1) % len(points)][1] - points[(index + 1) % len(points)][0] * point[1] for index, point in enumerate(points))


def canonical_contour(points):
    candidates = [points[index:] + points[:index] for index in range(len(points))]
    return min(candidates)


def contour_sort_key(points):
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return (min(xs), min(ys), max(xs), max(ys), len(points), tuple(points))


def source_font(path: Path):
    contents = path.read_bytes()
    if len(contents) != SOURCE_BYTES or hashlib.sha256(contents).hexdigest() != SOURCE_SHA256:
        raise ValueError("Vendored Alegreya source does not match ADR-0025.")
    return instantiateVariableFont(TTFont(path), {"wght": 500}, inplace=False)


def pair_kerning(font, glyph_names):
    pairs = []
    glyph_set = set(glyph_names.values())
    for lookup in font["GPOS"].table.LookupList.Lookup:
        if lookup.LookupType != 2:
            continue
        for table in lookup.SubTable:
            if table.Format != 2:
                raise ValueError("Unexpected pair-kerning table format.")
            class1 = table.ClassDef1.classDefs if table.ClassDef1 else {}
            class2 = table.ClassDef2.classDefs if table.ClassDef2 else {}
            for left in table.Coverage.glyphs:
                if left not in glyph_set:
                    continue
                for right in glyph_set:
                    first_index = class1.get(left, 0)
                    second_index = class2.get(right, 0)
                    record = table.Class1Record[first_index].Class2Record[second_index]
                    adjustment = getattr(record.Value1, "XAdvance", 0) if record.Value1 else 0
                    if adjustment:
                        pairs.append((left, right, round_positive_half(adjustment * UNITS / font["head"].unitsPerEm)))
    unique = {(left, right): adjustment for left, right, adjustment in pairs}
    return [
        {"leftGlyphKey": left, "rightGlyphKey": right, "adjustment": adjustment}
        for (left, right), adjustment in sorted(unique.items())
    ]


def build_pack(path: Path):
    font = source_font(path)
    upem = font["head"].unitsPerEm
    scale = UNITS / upem
    cmap = font.getBestCmap()
    code_points = list(range(0x41, 0x5B)) + list(range(0x61, 0x7B))
    glyph_names = {code_point: cmap[code_point] for code_point in code_points}
    if len(glyph_names) != len(code_points) or 0x20 not in cmap:
        raise ValueError("Pinned source does not cover ADR-0025's ASCII alphabet.")
    glyph_set = font.getGlyphSet()
    glyphs = []
    for code_point, glyph_name in sorted(glyph_names.items()):
        pen = FlatteningPen(glyph_set, scale)
        glyph_set[glyph_name].draw(pen)
        contours = sorted(pen.contours, key=contour_sort_key)
        xs = [point[0] for contour in contours for point in contour]
        ys = [point[1] for contour in contours for point in contour]
        width, lsb = font["hmtx"].metrics[glyph_name]
        glyphs.append({
            "glyphKey": glyph_name,
            "codePoint": code_point,
            "advanceWidth": round_positive_half(width * scale),
            "leftSideBearing": round_positive_half(lsb * scale),
            "bounds": {"minX": min(xs), "minY": min(ys), "maxX": max(xs), "maxY": max(ys)},
            "contours": [{"points": [{"x": x, "y": y} for x, y in contour]} for contour in contours],
        })
    space_width, _space_lsb = font["hmtx"].metrics[cmap[0x20]]
    hhea = font["hhea"]
    pack = {
        "assetId": "atlas-glyphs.alegreya-medium-ascii-v1",
        "assetSchemaVersion": 1,
        "glyphBehaviorVersion": 1,
        "unitsPerEm": UNITS,
        "ascender": round_positive_half(hhea.ascent * scale),
        "descender": round_positive_half(hhea.descent * scale),
        "lineGap": round_positive_half(hhea.lineGap * scale),
        "tracking": 0,
        "source": {
            "sourceUrl": SOURCE_URL,
            "sourceCommit": SOURCE_COMMIT,
            "sourceSha256": SOURCE_SHA256,
            "sourceByteLength": SOURCE_BYTES,
            "licenseId": "OFL-1.1",
        },
        "spaceAdvance": round_positive_half(space_width * scale),
        "glyphs": glyphs,
        "kerningPairs": pair_kerning(font, glyph_names),
        "contourCount": sum(len(glyph["contours"]) for glyph in glyphs),
        "pointCount": sum(len(contour["points"]) for glyph in glyphs for contour in glyph["contours"]),
    }
    digest = hashlib.sha256(json.dumps(pack, separators=(",", ":")).encode()).hexdigest()
    return {**pack, "canonicalPackSha256": digest}


def output_source(pack):
    rendered = json.dumps(pack, separators=(",", ":"), ensure_ascii=True)
    return "// Generated by tools/glyph-pack/convert.py; do not hand edit.\n" + "import type { AtlasGlyphPack } from '@ttrpg-map/core';\n\n" + f"export const ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_PACK = Object.freeze(({rendered}) as const satisfies AtlasGlyphPack);\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=SOURCE_PATH)
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    rendered = output_source(build_pack(arguments.source))
    if arguments.check:
        if not arguments.output.exists() or arguments.output.read_text() != rendered:
            raise SystemExit("atlas glyph pack differs; run tools/glyph-pack/convert.py to regenerate it")
        return
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(rendered)


if __name__ == "__main__":
    main()
