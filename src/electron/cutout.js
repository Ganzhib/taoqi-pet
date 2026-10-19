// One-click background removal for imported pet pictures.
// Pure JS and fully offline: the picture never leaves the user's machine.
// The scan works on raw 4-bytes-per-pixel buffers with alpha as the last
// byte, so BGRA and RGBA orders both behave identically - channel order
// never matters for colour distance.

const MAX_EDGE = 2400; // larger pictures are downscaled before scanning
const TOLERANCE = 42; // per-channel distance still treated as background
const MIN_REMOVED_RATIO = 0.03; // below this there is no obvious background
const MAX_REMOVED_RATIO = 0.995; // backstop when nearly everything matched
const MIN_SUBJECT_SHARE = 0.6; // the kept pixels must form one solid subject

function channelDistance(a, b) {
  return Math.max(
    Math.abs(a[0] - b[0]),
    Math.abs(a[1] - b[1]),
    Math.abs(a[2] - b[2]),
  );
}

// Collect the dominant colours along the four borders. Photographs and
// downloads usually share one flat backdrop; a few stray edge pixels must not
// widen the seed set, so only clusters covering at least 2% of the border
// survive.
function borderSeeds(rgba, width, height) {
  const clusters = [];
  const borderPixels = 2 * (width + height) - 4;
  const minimum = Math.max(2, Math.round(borderPixels * 0.02));
  const step = Math.max(1, Math.round(Math.min(width, height) / 240));
  const consider = (x, y) => {
    const index = (y * width + x) * 4;
    if (rgba[index + 3] < 200) return;
    const color = [rgba[index], rgba[index + 1], rgba[index + 2]];
    for (const cluster of clusters) {
      if (channelDistance(cluster.center, color) <= TOLERANCE) {
        cluster.count += 1;
        for (let c = 0; c < 3; c += 1) {
          cluster.center[c] = Math.round((cluster.center[c] * (cluster.count - 1) + color[c]) / cluster.count);
        }
        return;
      }
    }
    clusters.push({ center: color, count: 1 });
  };
  for (let x = 0; x < width; x += step) {
    consider(x, 0);
    consider(x, height - 1);
  }
  for (let y = 0; y < height; y += step) {
    consider(0, y);
    consider(width - 1, y);
  }
  return clusters.filter((cluster) => cluster.count >= minimum).map((cluster) => cluster.center);
}

// Flood fill inwards from every border pixel that matches a seed colour or is
// already transparent. Interior pockets keep their colour, so a white belly
// on a white backdrop survives.
function removeBackground(rgba, width, height) {
  const total = width * height;
  if (total === 0 || rgba.length < total * 4) return null;
  const seeds = borderSeeds(rgba, width, height);
  const background = new Uint8Array(total);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixel = y * width + x;
    if (background[pixel]) return;
    const index = pixel * 4;
    if (rgba[index + 3] < 8) {
      background[pixel] = 1;
      stack.push(pixel);
      return;
    }
    const color = [rgba[index], rgba[index + 1], rgba[index + 2]];
    if (seeds.some((seed) => channelDistance(seed, color) <= TOLERANCE)) {
      background[pixel] = 1;
      stack.push(pixel);
    }
  };
  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length > 0) {
    const pixel = stack.pop();
    const x = pixel % width;
    const y = (pixel - x) / width;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  let removed = 0;
  for (let pixel = 0; pixel < total; pixel += 1) {
    if (background[pixel]) removed += 1;
  }
  const ratio = removed / total;
  if (ratio < MIN_REMOVED_RATIO || ratio > MAX_REMOVED_RATIO) return null;
  // A correct cutout leaves one solid subject. When the seeds were too wide
  // the pet itself is eaten and only scattered specks survive - refuse those
  // instead of saving a shredded picture.
  const kept = total - removed;
  if (kept === 0) return null;
  if (largestKeptBlob(background, width, height) < kept * MIN_SUBJECT_SHARE) return null;
  for (let pixel = 0; pixel < total; pixel += 1) {
    if (!background[pixel]) continue;
    const index = pixel * 4;
    rgba[index] = 0;
    rgba[index + 1] = 0;
    rgba[index + 2] = 0;
    rgba[index + 3] = 0;
  }
  return rgba;
}

// Size of the biggest 4-connected run of kept pixels.
function largestKeptBlob(background, width, height) {
  const total = width * height;
  const seen = new Uint8Array(total);
  const queue = [];
  let largest = 0;
  for (let start = 0; start < total; start += 1) {
    if (background[start] || seen[start]) continue;
    let size = 0;
    seen[start] = 1;
    queue.push(start);
    while (queue.length > 0) {
      const pixel = queue.pop();
      size += 1;
      const x = pixel % width;
      const y = (pixel - x) / width;
      const neighbours = [
        y > 0 ? pixel - width : -1,
        y < height - 1 ? pixel + width : -1,
        x > 0 ? pixel - 1 : -1,
        x < width - 1 ? pixel + 1 : -1,
      ];
      for (const next of neighbours) {
        if (next < 0 || seen[next] || background[next]) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    largest = Math.max(largest, size);
  }
  return largest;
}

// Decode a PNG/JPG/WebP import, erase its background and re-encode as PNG.
// Returns null when the picture has no clear backdrop or cannot be decoded,
// so callers simply keep the original file.
function cutoutStaticImage(bytes) {
  try {
    const { nativeImage } = require("electron");
    let image = nativeImage.createFromBuffer(bytes);
    if (image.isEmpty()) return null;
    const size = image.getSize();
    const longest = Math.max(size.width, size.height);
    if (longest > MAX_EDGE) {
      const scale = MAX_EDGE / longest;
      image = image.resize({
        width: Math.max(1, Math.round(size.width * scale)),
        height: Math.max(1, Math.round(size.height * scale)),
      });
    }
    const { width, height } = image.getSize();
    const bitmap = image.getBitmap();
    if (bitmap.length !== width * height * 4) return null;
    const cleared = removeBackground(bitmap, width, height);
    if (!cleared) return null;
    const cut = nativeImage.createFromBitmap(
      Buffer.from(cleared.buffer, cleared.byteOffset, cleared.length),
      { width, height },
    );
    const png = cut.toPNG();
    return png.length > 0 ? png : null;
  } catch {
    return null;
  }
}

module.exports = { removeBackground, cutoutStaticImage };
