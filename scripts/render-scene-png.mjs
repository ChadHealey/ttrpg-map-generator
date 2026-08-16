/** Deterministic, dependency-free raster evidence for the renderer-neutral RenderScene contract. */

const PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);

/**
 * Rasterize the geometric primitives used by proof fixtures and encode an RGBA PNG without
 * platform image libraries. This is visual evidence tooling, not a production render backend.
 */
export function renderSceneToDeterministicPng(scene) {
  const width = requireDimension(scene.widthPx, 'widthPx');
  const height = requireDimension(scene.heightPx, 'heightPx');
  const pixels = new Uint8Array(width * height * 4);

  for (const node of scene.nodes) {
    switch (node.kind) {
      case 'rectangle':
        fillRectangle(pixels, width, height, node, parseColor(node.fillColor));
        break;
      case 'polygon':
        fillPolygon(pixels, width, height, node.points, parseColor(node.paint.fillColor));
        strokePath(
          pixels,
          width,
          height,
          node.points,
          true,
          node.paint.strokeWidthPx,
          parseColor(node.paint.strokeColor),
        );
        break;
      case 'polyline':
        strokePath(
          pixels,
          width,
          height,
          node.points,
          false,
          node.strokeWidthPx,
          parseColor(node.strokeColor),
        );
        break;
      case 'label':
        throw new Error('Deterministic proof PNGs do not rasterize text labels.');
    }
  }

  const indexed = indexedScanlines(pixels, width, height);

  const header = new Uint8Array(13);
  writeUint32(header, 0, width);
  writeUint32(header, 4, height);
  header.set([2, 3, 0, 0, 0], 8);
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('PLTE', indexed.palette),
    pngChunk('IDAT', uncompressedZlib(indexed.scanlines)),
    pngChunk('IEND', new Uint8Array()),
  ]);
}

function indexedScanlines(pixels, width, height) {
  const paletteEntries = [];
  const paletteIndexes = new Map();
  const packedRowLength = Math.ceil(width / 4);
  const scanlines = new Uint8Array(height * (1 + packedRowLength));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (1 + packedRowLength);
    scanlines[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = (y * width + x) * 4;
      if (pixels[pixelOffset + 3] !== 255) {
        throw new Error('Deterministic proof PNGs require an opaque scene background.');
      }
      const red = pixels[pixelOffset];
      const green = pixels[pixelOffset + 1];
      const blue = pixels[pixelOffset + 2];
      const key = `${String(red)},${String(green)},${String(blue)}`;
      let paletteIndex = paletteIndexes.get(key);
      if (paletteIndex === undefined) {
        paletteIndex = paletteEntries.length / 3;
        if (paletteIndex >= 4) {
          throw new Error('Deterministic proof PNGs support at most four opaque colors.');
        }
        paletteEntries.push(red, green, blue);
        paletteIndexes.set(key, paletteIndex);
      }
      const packedOffset = rowOffset + 1 + Math.floor(x / 4);
      scanlines[packedOffset] |= paletteIndex << (6 - (x % 4) * 2);
    }
  }
  return { palette: Uint8Array.from(paletteEntries), scanlines };
}

function requireDimension(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 8192) {
    throw new Error(`RenderScene ${label} must be an integer from 1 through 8192.`);
  }
  return value;
}

function parseColor(value) {
  const match = /^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/iu.exec(value);
  if (match === null) throw new Error(`Unsupported proof color ${String(value)}.`);
  return [
    Number.parseInt(match[1], 16),
    Number.parseInt(match[2], 16),
    Number.parseInt(match[3], 16),
    255,
  ];
}

function fillRectangle(pixels, width, height, node, color) {
  const minimumX = clamp(Math.floor(node.xPx), 0, width);
  const maximumX = clamp(Math.ceil(node.xPx + node.widthPx), 0, width);
  const minimumY = clamp(Math.floor(node.yPx), 0, height);
  const maximumY = clamp(Math.ceil(node.yPx + node.heightPx), 0, height);
  for (let y = minimumY; y < maximumY; y += 1) {
    for (let x = minimumX; x < maximumX; x += 1) setPixel(pixels, width, x, y, color);
  }
}

function fillPolygon(pixels, width, height, points, color) {
  if (points.length < 3) return;
  const bounds = pointBounds(points, 0, width, height);
  for (let y = bounds.minimumY; y < bounds.maximumY; y += 1) {
    for (let x = bounds.minimumX; x < bounds.maximumX; x += 1) {
      if (isPointInPolygon(x + 0.5, y + 0.5, points)) setPixel(pixels, width, x, y, color);
    }
  }
}

function strokePath(pixels, width, height, points, closed, strokeWidth, color) {
  if (points.length < 2 || !(strokeWidth > 0)) return;
  const radius = strokeWidth / 2;
  const bounds = pointBounds(points, radius, width, height);
  const lastSegment = closed ? points.length : points.length - 1;
  for (let y = bounds.minimumY; y < bounds.maximumY; y += 1) {
    for (let x = bounds.minimumX; x < bounds.maximumX; x += 1) {
      const pointX = x + 0.5;
      const pointY = y + 0.5;
      let shouldStroke = false;
      for (let index = 0; index < lastSegment; index += 1) {
        const start = points[index];
        const end = points[(index + 1) % points.length];
        if (distanceSquaredToSegment(pointX, pointY, start, end) <= radius * radius) {
          shouldStroke = true;
          break;
        }
      }
      if (shouldStroke) setPixel(pixels, width, x, y, color);
    }
  }
}

function pointBounds(points, padding, width, height) {
  const xCoordinates = points.map(({ xPx }) => xPx);
  const yCoordinates = points.map(({ yPx }) => yPx);
  return {
    minimumX: clamp(Math.floor(Math.min(...xCoordinates) - padding), 0, width),
    maximumX: clamp(Math.ceil(Math.max(...xCoordinates) + padding), 0, width),
    minimumY: clamp(Math.floor(Math.min(...yCoordinates) - padding), 0, height),
    maximumY: clamp(Math.ceil(Math.max(...yCoordinates) + padding), 0, height),
  };
}

function isPointInPolygon(x, y, points) {
  let inside = false;
  for (
    let index = 0, previous = points.length - 1;
    index < points.length;
    previous = index, index += 1
  ) {
    const currentPoint = points[index];
    const previousPoint = points[previous];
    const crosses =
      currentPoint.yPx > y !== previousPoint.yPx > y &&
      x <
        ((previousPoint.xPx - currentPoint.xPx) * (y - currentPoint.yPx)) /
          (previousPoint.yPx - currentPoint.yPx) +
          currentPoint.xPx;
    if (crosses) inside = !inside;
  }
  return inside;
}

function distanceSquaredToSegment(x, y, start, end) {
  const deltaX = end.xPx - start.xPx;
  const deltaY = end.yPx - start.yPx;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const ratio =
    lengthSquared === 0
      ? 0
      : clamp(((x - start.xPx) * deltaX + (y - start.yPx) * deltaY) / lengthSquared, 0, 1);
  const differenceX = x - (start.xPx + ratio * deltaX);
  const differenceY = y - (start.yPx + ratio * deltaY);
  return differenceX * differenceX + differenceY * differenceY;
}

function setPixel(pixels, width, x, y, color) {
  const offset = (y * width + x) * 4;
  pixels.set(color, offset);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function uncompressedZlib(bytes) {
  const blocks = [];
  for (let offset = 0; offset < bytes.length; offset += 65_535) {
    const length = Math.min(65_535, bytes.length - offset);
    const final = offset + length === bytes.length;
    const block = new Uint8Array(5 + length);
    block[0] = final ? 1 : 0;
    block[1] = length & 0xff;
    block[2] = length >>> 8;
    const inverse = 0xffff - length;
    block[3] = inverse & 0xff;
    block[4] = inverse >>> 8;
    block.set(bytes.subarray(offset, offset + length), 5);
    blocks.push(block);
  }
  const checksum = new Uint8Array(4);
  writeUint32(checksum, 0, adler32(bytes));
  return Buffer.concat([Uint8Array.of(0x78, 0x01), ...blocks, checksum]);
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const chunk = new Uint8Array(12 + data.length);
  writeUint32(chunk, 0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  writeUint32(chunk, 8 + data.length, crc32(Buffer.concat([typeBytes, data])));
  return chunk;
}

function writeUint32(bytes, offset, value) {
  bytes[offset] = value >>> 24;
  bytes[offset + 1] = value >>> 16;
  bytes[offset + 2] = value >>> 8;
  bytes[offset + 3] = value;
}

function adler32(bytes) {
  let first = 1;
  let second = 0;
  for (const byte of bytes) {
    first = (first + byte) % 65_521;
    second = (second + first) % 65_521;
  }
  return ((second << 16) | first) >>> 0;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
