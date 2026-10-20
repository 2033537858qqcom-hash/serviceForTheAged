function sliderShift(index, dx, pageWidth, count) {
  const width = pageWidth > 0 ? pageWidth : 1;
  const raw = index - dx / width;
  const max = Math.max(0, count - 1);
  if (raw < 0) return raw * 0.35;
  if (raw > max) return max + (raw - max) * 0.35;
  return raw;
}

module.exports = { sliderShift };
