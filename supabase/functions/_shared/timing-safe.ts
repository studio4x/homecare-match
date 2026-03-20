const toBytes = (value: string) => new TextEncoder().encode(String(value || ""));

export const timingSafeEqual = (leftValue: string, rightValue: string) => {
  const left = toBytes(leftValue);
  const right = toBytes(rightValue);
  const maxLength = Math.max(left.length, right.length);

  let diff = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    const leftByte = left[index] ?? 0;
    const rightByte = right[index] ?? 0;
    diff |= leftByte ^ rightByte;
  }

  return diff === 0;
};

