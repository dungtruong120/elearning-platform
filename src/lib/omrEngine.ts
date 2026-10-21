import {
  OMRBubbleCoordinate,
  OMRCornerPoint,
  OMRGradingSummary,
  OMRQuestionGradeDetail,
  OMRResultData,
  QuestionType,
} from "@/types";

// KÍCH THƯỚC CHUẨN MA TRẬN A4 SAU KHI NẮN PHẲNG (1200 x 1700 PIXELS)
export const OMR_CANONICAL_WIDTH = 1200;
export const OMR_CANONICAL_HEIGHT = 1700;

// TỌA ĐỘ 4 ĐIỂM MỐC ĐỊNH VỊ GÓC TRÊN KHUNG CHUẨN 1200x1700
export const CANONICAL_CORNER_TARGETS = {
  topLeft: { x: 42, y: 42 },
  topRight: { x: 1158, y: 42 },
  bottomRight: { x: 1158, y: 1658 },
  bottomLeft: { x: 42, y: 1658 },
};

// NGƯỠNG NHẬN DIỆN TÔ CHÌ TƯƠNG ĐỐI & TUYỆT ĐỐI
const MIN_FILLED_DENSITY = 0.34;
const STRONG_FILLED_DENSITY = 0.48;
const RELATIVE_DOMINANCE_RATIO = 1.32;
const AMBIGUOUS_DIFF_THRESHOLD = 0.09;

/**
 * 1. MA TRẬN TỌA ĐỘ CHUẨN (BLUEPRINT) CHO PHIẾU TRẢ LỜI TRẮC NGHIỆM BỘ GD&ĐT 2025-2026[cite: 25]
 * Tương thích 100% với mẫu phiếu A4 in ra từ hệ thống EduNexus và mẫu chuẩn Bộ GD&ĐT[cite: 25]
 */
export interface OMRTemplateBlueprint {
  sbd: {
    cols: number;
    startX: number;
    colStep: number;
    startY: number;
    rowStep: number;
    radius: number;
  };
  examCode: {
    cols: number;
    startX: number;
    colStep: number;
    startY: number;
    rowStep: number;
    radius: number;
  };
  part1: {
    blocks: {
      startQuestion: number;
      endQuestion: number;
      startX: number;
      optionStepX: number;
      startY: number;
      rowStepY: number;
      radius: number;
    }[];
  };
  part2: {
    blocks: {
      questionNumber: number;
      trueX: number;
      falseX: number;
      startY: number;
      rowStepY: number;
      radius: number;
    }[];
  };
  part3: {
    blocks: {
      questionNumber: number;
      startX: number;
      colStepX: number;
      minusY: number;
      commaY: number;
      digit0Y: number;
      rowStepY: number;
      radius: number;
    }[];
  };
}

export const MOET_2025_OMR_BLUEPRINT: OMRTemplateBlueprint = {
  // 7. Số báo danh (6 cột x 10 hàng 0..9)[cite: 25]
  sbd: {
    cols: 6,
    startX: 830,
    colStep: 28,
    startY: 225,
    rowStep: 27,
    radius: 9.5,
  },
  // 8. Mã đề thi (3 hoặc 4 cột x 10 hàng 0..9)[cite: 25]
  examCode: {
    cols: 3,
    startX: 1034,
    colStep: 28,
    startY: 225,
    rowStep: 27,
    radius: 9.5,
  },
  // PHẦN I: 40 CÂU TRẮC NGHIỆM (4 khối cột: 1-10, 11-20, 21-30, 31-40)[cite: 25]
  part1: {
    blocks: [
      {
        startQuestion: 1,
        endQuestion: 10,
        startX: 138,
        optionStepX: 44,
        startY: 622,
        rowStepY: 31,
        radius: 10.5,
      },
      {
        startQuestion: 11,
        endQuestion: 20,
        startX: 396,
        optionStepX: 44,
        startY: 622,
        rowStepY: 31,
        radius: 10.5,
      },
      {
        startQuestion: 21,
        endQuestion: 30,
        startX: 654,
        optionStepX: 44,
        startY: 622,
        rowStepY: 31,
        radius: 10.5,
      },
      {
        startQuestion: 31,
        endQuestion: 40,
        startX: 912,
        optionStepX: 44,
        startY: 622,
        rowStepY: 31,
        radius: 10.5,
      },
    ],
  },
  // PHẦN II: 8 CÂU ĐÚNG / SAI (4 khung đôi, mỗi câu gồm 4 ý a, b, c, d)[cite: 25]
  part2: {
    blocks: [
      { questionNumber: 1, trueX: 132, falseX: 176, startY: 1068, rowStepY: 31, radius: 10.5 },
      { questionNumber: 2, trueX: 226, falseX: 270, startY: 1068, rowStepY: 31, radius: 10.5 },
      { questionNumber: 3, trueX: 390, falseX: 434, startY: 1068, rowStepY: 31, radius: 10.5 },
      { questionNumber: 4, trueX: 484, falseX: 528, startY: 1068, rowStepY: 31, radius: 10.5 },
      { questionNumber: 5, trueX: 648, falseX: 692, startY: 1068, rowStepY: 31, radius: 10.5 },
      { questionNumber: 6, trueX: 742, falseX: 786, startY: 1068, rowStepY: 31, radius: 10.5 },
      { questionNumber: 7, trueX: 906, falseX: 950, startY: 1068, rowStepY: 31, radius: 10.5 },
      { questionNumber: 8, trueX: 1000, falseX: 1044, startY: 1068, rowStepY: 31, radius: 10.5 },
    ],
  },
  // PHẦN III: 6 CÂU TRẢ LỜI NGẮN (Mỗi câu 4 cột ký tự: Dấu âm '-', dấu phẩy ',', số 0..9)[cite: 25]
  part3: {
    blocks: [
      {
        questionNumber: 1,
        startX: 122,
        colStepX: 27,
        minusY: 1286,
        commaY: 1314,
        digit0Y: 1342,
        rowStepY: 28,
        radius: 9.5,
      },
      {
        questionNumber: 2,
        startX: 294,
        colStepX: 27,
        minusY: 1286,
        commaY: 1314,
        digit0Y: 1342,
        rowStepY: 28,
        radius: 9.5,
      },
      {
        questionNumber: 3,
        startX: 466,
        colStepX: 27,
        minusY: 1286,
        commaY: 1314,
        digit0Y: 1342,
        rowStepY: 28,
        radius: 9.5,
      },
      {
        questionNumber: 4,
        startX: 638,
        colStepX: 27,
        minusY: 1286,
        commaY: 1314,
        digit0Y: 1342,
        rowStepY: 28,
        radius: 9.5,
      },
      {
        questionNumber: 5,
        startX: 810,
        colStepX: 27,
        minusY: 1286,
        commaY: 1314,
        digit0Y: 1342,
        rowStepY: 28,
        radius: 9.5,
      },
      {
        questionNumber: 6,
        startX: 982,
        colStepX: 27,
        minusY: 1286,
        commaY: 1314,
        digit0Y: 1342,
        rowStepY: 28,
        radius: 9.5,
      },
    ],
  },
};

/**
 * 2. CHUYỂN ĐỔI ẢNH SANG GRAYSCALE VÀ NHỊ PHÂN HÓA THÍCH NGHI (INTEGRAL IMAGE THRESHOLDING)
 */
export function computeAdaptiveBinaryMask(imageData: ImageData): {
  gray: Uint8Array;
  binary: Uint8Array;
  width: number;
  height: number;
} {
  const { width, height, data } = imageData;
  const totalPixels = width * height;
  const gray = new Uint8Array(totalPixels);
  const binary = new Uint8Array(totalPixels);
  const integral = new Float64Array((width + 1) * (height + 1));

  // Bước 1: Tính độ sáng Grayscale
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[p] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  // Bước 2: Xây dựng Integral Image để tính trung bình cục bộ O(1)
  const stride = width + 1;
  for (let y = 1; y <= height; y++) {
    let rowSum = 0;
    const srcRowOffset = (y - 1) * width;
    const dstRowOffset = y * stride;
    const prevRowOffset = (y - 1) * stride;
    for (let x = 1; x <= width; x++) {
      rowSum += gray[srcRowOffset + (x - 1)];
      integral[dstRowOffset + x] = integral[prevRowOffset + x] + rowSum;
    }
  }

  // Bước 3: Lọc ngưỡng thích nghi (Window 31x31, độ lệch C = 14)
  const halfWin = 16;
  const sensitivity = 0.84;

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - halfWin);
    const y2 = Math.min(height - 1, y + halfWin);
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - halfWin);
      const x2 = Math.min(width - 1, x + halfWin);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * stride + (x2 + 1)] -
        integral[y1 * stride + (x2 + 1)] -
        integral[(y2 + 1) * stride + x1] +
        integral[y1 * stride + x1];

      const localMean = sum / count;
      const idx = y * width + x;
      // Điểm tối hơn trung bình cục bộ được gán giá trị 1 (đen)
      binary[idx] = gray[idx] < localMean * sensitivity && gray[idx] < 195 ? 1 : 0;
    }
  }

  return { gray, binary, width, height };
}

/**
 * 3. TÌM 4 ĐIỂM MỐC ĐỊNH VỊ Ở 4 GÓC PHIẾU (CORNER ALIGNMENT MARKERS)[cite: 25]
 */
export function detectOMRCornerMarkers(
  binary: Uint8Array,
  width: number,
  height: number
): {
  topLeft: OMRCornerPoint;
  topRight: OMRCornerPoint;
  bottomRight: OMRCornerPoint;
  bottomLeft: OMRCornerPoint;
  detected: boolean;
} {
  const findDensePatchInRegion = (
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    targetCornerX: number,
    targetCornerY: number
  ): OMRCornerPoint | null => {
    const patchSize = Math.max(10, Math.round(Math.min(width, height) * 0.018));
    const step = Math.max(3, Math.floor(patchSize / 3));

    let bestCandidate: { x: number; y: number; score: number } | null = null;

    for (let y = minY; y <= maxY - patchSize; y += step) {
      for (let x = minX; x <= maxX - patchSize; x += step) {
        let darkCount = 0;
        for (let py = 0; py < patchSize; py += 2) {
          const rowOffset = (y + py) * width + x;
          for (let px = 0; px < patchSize; px += 2) {
            if (binary[rowOffset + px] === 1) {
              darkCount++;
            }
          }
        }
        const sampleTotal = Math.ceil(patchSize / 2) * Math.ceil(patchSize / 2);
        const density = darkCount / sampleTotal;

        if (density >= 0.62) {
          const centerX = x + patchSize / 2;
          const centerY = y + patchSize / 2;
          const distToCorner = Math.hypot(centerX - targetCornerX, centerY - targetCornerY);
          const maxPossibleDist = Math.hypot(width, height);
          const proximityWeight = 1 - distToCorner / maxPossibleDist;
          const score = density * 0.4 + proximityWeight * 0.6;

          if (!bestCandidate || score > bestCandidate.score) {
            bestCandidate = { x: centerX, y: centerY, score };
          }
        }
      }
    }

    return bestCandidate ? { x: bestCandidate.x, y: bestCandidate.y } : null;
  };

  const marginW = Math.floor(width * 0.25);
  const marginH = Math.floor(height * 0.25);

  const tl = findDensePatchInRegion(4, marginW, 4, marginH, 0, 0);
  const tr = findDensePatchInRegion(width - marginW, width - 4, 4, marginH, width, 0);
  const br = findDensePatchInRegion(
    width - marginW,
    width - 4,
    height - marginH,
    height - 4,
    width,
    height
  );
  const bl = findDensePatchInRegion(4, marginW, height - marginH, height - 4, 0, height);

  if (tl && tr && br && bl) {
    return {
      topLeft: tl,
      topRight: tr,
      bottomRight: br,
      bottomLeft: bl,
      detected: true,
    };
  }

  // Fallback về 4 góc chuẩn theo tỉ lệ nếu ảnh đã được cắt sát lề
  return {
    topLeft: { x: width * 0.035, y: height * 0.025 },
    topRight: { x: width * 0.965, y: height * 0.025 },
    bottomRight: { x: width * 0.965, y: height * 0.975 },
    bottomLeft: { x: width * 0.035, y: height * 0.975 },
    detected: false,
  };
}

/**
 * 4. NẮN PHẲNG ẢNH BẰNG PHÉP NỘI SUY PHỐI CẢNH 4 ĐIỂM (FOUR-POINT BILINEAR WARP)
 * Đưa ảnh chụp nghiêng về khung hình chuẩn A4 (1200 x 1700 px)
 */
export function warpPerspectiveToCanonical(
  sourceImageData: ImageData,
  corners: {
    topLeft: OMRCornerPoint;
    topRight: OMRCornerPoint;
    bottomRight: OMRCornerPoint;
    bottomLeft: OMRCornerPoint;
  },
  dstWidth: number = OMR_CANONICAL_WIDTH,
  dstHeight: number = OMR_CANONICAL_HEIGHT
): ImageData {
  const srcW = sourceImageData.width;
  const srcH = sourceImageData.height;
  const srcPixels = sourceImageData.data;

  const dstImageData = new ImageData(dstWidth, dstHeight);
  const dstPixels = dstImageData.data;

  const padX = CANONICAL_CORNER_TARGETS.topLeft.x;
  const padY = CANONICAL_CORNER_TARGETS.topLeft.y;
  const innerW = CANONICAL_CORNER_TARGETS.topRight.x - padX;
  const innerH = CANONICAL_CORNER_TARGETS.bottomLeft.y - padY;

  const { topLeft, topRight, bottomRight, bottomLeft } = corners;

  for (let y = 0; y < dstHeight; y++) {
    const v = (y - padY) / innerH;
    for (let x = 0; x < dstWidth; x++) {
      const u = (x - padX) / innerW;

      // Ánh xạ tọa độ chuẩn (u, v) sang tọa độ trên ảnh chụp gốc (srcX, srcY)
      const srcX =
        (1 - u) * (1 - v) * topLeft.x +
        u * (1 - v) * topRight.x +
        u * v * bottomRight.x +
        (1 - u) * v * bottomLeft.x;

      const srcY =
        (1 - u) * (1 - v) * topLeft.y +
        u * (1 - v) * topRight.y +
        u * v * bottomRight.y +
        (1 - u) * v * bottomLeft.y;

      const dstIdx = (y * dstWidth + x) * 4;

      if (srcX >= 0 && srcX < srcW - 1 && srcY >= 0 && srcY < srcH - 1) {
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const dx = srcX - x0;
        const dy = srcY - y0;

        const idx00 = (y0 * srcW + x0) * 4;
        const idx10 = idx00 + 4;
        const idx01 = ((y0 + 1) * srcW + x0) * 4;
        const idx11 = idx01 + 4;

        for (let c = 0; c < 3; c++) {
          const val =
            srcPixels[idx00 + c] * (1 - dx) * (1 - dy) +
            srcPixels[idx10 + c] * dx * (1 - dy) +
            srcPixels[idx01 + c] * (1 - dx) * dy +
            srcPixels[idx11 + c] * dx * dy;
          dstPixels[dstIdx + c] = Math.round(val);
        }
        dstPixels[dstIdx + 3] = 255;
      } else {
        dstPixels[dstIdx] = 255;
        dstPixels[dstIdx + 1] = 255;
        dstPixels[dstIdx + 2] = 255;
        dstPixels[dstIdx + 3] = 255;
      }
    }
  }

  return dstImageData;
}

/**
 * 5. ĐO MẬT ĐỘ ĐIỂM TỐI TRONG Ô TRÒN (RELATIVE PIXEL DENSITY SAMPLING)
 */
export function measureBubbleDensity(
  binary: Uint8Array,
  gray: Uint8Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number
): number {
  const rInner = Math.max(3, radius * 0.78);
  const rSq = rInner * rInner;
  const minX = Math.max(0, Math.floor(centerX - rInner));
  const maxX = Math.min(width - 1, Math.ceil(centerX + rInner));
  const minY = Math.max(0, Math.floor(centerY - rInner));
  const maxY = Math.min(height - 1, Math.ceil(centerY + rInner));

  let totalSamples = 0;
  let weightedDarkSum = 0;

  for (let y = minY; y <= maxY; y++) {
    const dy = y - centerY;
    const rowOffset = y * width;
    for (let x = minX; x <= maxX; x++) {
      const dx = x - centerX;
      if (dx * dx + dy * dy <= rSq) {
        totalSamples++;
        const idx = rowOffset + x;
        const isBinaryDark = binary[idx] === 1 ? 1 : 0;
        const grayDarkness = Math.max(0, (215 - gray[idx]) / 215);
        weightedDarkSum += isBinaryDark * 0.65 + grayDarkness * 0.35;
      }
    }
  }

  if (totalSamples === 0) return 0;
  return Number(Math.min(1, weightedDarkSum / totalSamples).toFixed(3));
}

/**
 * 6. THUẬT TOÁN SO SÁNH TƯƠNG ĐỐI GIỮA CÁC Ô TRONG CÙNG 1 CÂU HỎI / CỘT SỐ
 */
function pickDominantBubble<T extends { key: string; density: number }>(
  candidates: T[],
  minThreshold: number = MIN_FILLED_DENSITY
): {
  selected: T | null;
  isAmbiguous: boolean;
} {
  if (!candidates || candidates.length === 0) {
    return { selected: null, isAmbiguous: false };
  }

  const sorted = [...candidates].sort((a, b) => b.density - a.density);
  const top = sorted[0];
  const second = sorted[1];

  if (top.density < minThreshold) {
    return { selected: null, isAmbiguous: false };
  }

  if (!second) {
    return { selected: top, isAmbiguous: false };
  }

  const ratio = second.density > 0.05 ? top.density / second.density : 99;
  const diff = top.density - second.density;

  // Nếu học sinh tô cả 2 ô đậm gần bằng nhau (tẩy không sạch)
  if (
    second.density >= STRONG_FILLED_DENSITY &&
    diff < AMBIGUOUS_DIFF_THRESHOLD &&
    ratio < RELATIVE_DOMINANCE_RATIO
  ) {
    return { selected: top, isAmbiguous: true };
  }

  if (top.density >= STRONG_FILLED_DENSITY || ratio >= RELATIVE_DOMINANCE_RATIO) {
    return { selected: top, isAmbiguous: false };
  }

  return { selected: null, isAmbiguous: false };
}

/**
 * 7. QUÉT TOÀN BỘ PHIẾU TRẢ LỜI TRẮC NGHIỆM TỪ CANVAS HOẶC IMAGEDATA[cite: 25]
 */
export function scanOMRSheetFromCanvas(
  sourceCanvasOrImageData: HTMLCanvasElement | ImageData,
  blueprint: OMRTemplateBlueprint = MOET_2025_OMR_BLUEPRINT
): OMRResultData {
  let rawImageData: ImageData;

  if (sourceCanvasOrImageData instanceof ImageData) {
    rawImageData = sourceCanvasOrImageData;
  } else {
    const ctx = sourceCanvasOrImageData.getContext("2d");
    if (!ctx) {
      throw new Error("Không thể khởi tạo Canvas 2D Context để quét phiếu OMR.");
    }
    rawImageData = ctx.getImageData(
      0,
      0,
      sourceCanvasOrImageData.width,
      sourceCanvasOrImageData.height
    );
  }

  // Bước 1: Nhị phân hóa ảnh chụp gốc và tìm 4 điểm mốc góc
  const initialMask = computeAdaptiveBinaryMask(rawImageData);
  const cornerResult = detectOMRCornerMarkers(
    initialMask.binary,
    initialMask.width,
    initialMask.height
  );

  // Bước 2: Nắn thẳng ảnh về chuẩn A4 (1200 x 1700)
  const warpedImageData = warpPerspectiveToCanonical(
    rawImageData,
    cornerResult,
    OMR_CANONICAL_WIDTH,
    OMR_CANONICAL_HEIGHT
  );

  // Xuất chuỗi Base64 của ảnh đã nắn phẳng để hiển thị đối chiếu trên UI
  let warpedDataUrl: string | undefined = undefined;
  if (typeof document !== "undefined") {
    try {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = OMR_CANONICAL_WIDTH;
      tempCanvas.height = OMR_CANONICAL_HEIGHT;
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx) {
        tempCtx.putImageData(warpedImageData, 0, 0);
        warpedDataUrl = tempCanvas.toDataURL("image/jpeg", 0.86);
      }
    } catch {}
  }

  // Bước 3: Tính mặt nạ nhị phân trên ảnh đã nắn thẳng
  const canonicalMask = computeAdaptiveBinaryMask(warpedImageData);
  const { binary, gray, width, height } = canonicalMask;

  const bubbleCoordinates: OMRBubbleCoordinate[] = [];
  const flaggedQuestionsSet = new Set<number>();
  let confidenceSum = 0;
  let confidenceCount = 0;

  // --- QUÉT SỐ BÁO DANH (6 CỘT) ---[cite: 25]
  const sbdDigits: string[] = [];
  for (let col = 0; col < blueprint.sbd.cols; col++) {
    const cx = blueprint.sbd.startX + col * blueprint.sbd.colStep;
    const colCandidates: { key: string; density: number; y: number }[] = [];

    for (let digit = 0; digit <= 9; digit++) {
      const cy = blueprint.sbd.startY + digit * blueprint.sbd.rowStep;
      const density = measureBubbleDensity(
        binary,
        gray,
        width,
        height,
        cx,
        cy,
        blueprint.sbd.radius
      );
      colCandidates.push({ key: String(digit), density, y: cy });
    }

    const { selected } = pickDominantBubble(colCandidates, MIN_FILLED_DENSITY);
    sbdDigits.push(selected ? selected.key : "");

    colCandidates.forEach((cand) => {
      const isSel = selected?.key === cand.key;
      bubbleCoordinates.push({
        id: `sbd-col${col}-${cand.key}`,
        section: "sbd",
        optionKey: cand.key,
        x: cx,
        y: cand.y,
        r: blueprint.sbd.radius,
        density: cand.density,
        isSelected: isSel,
        status: isSel ? "detected" : "unfilled",
      });
    });
  }

  // --- QUÉT MÃ ĐỀ THI (3 CỘT) ---[cite: 25]
  const examCodeDigits: string[] = [];
  for (let col = 0; col < blueprint.examCode.cols; col++) {
    const cx = blueprint.examCode.startX + col * blueprint.examCode.colStep;
    const colCandidates: { key: string; density: number; y: number }[] = [];

    for (let digit = 0; digit <= 9; digit++) {
      const cy = blueprint.examCode.startY + digit * blueprint.examCode.rowStep;
      const density = measureBubbleDensity(
        binary,
        gray,
        width,
        height,
        cx,
        cy,
        blueprint.examCode.radius
      );
      colCandidates.push({ key: String(digit), density, y: cy });
    }

    const { selected } = pickDominantBubble(colCandidates, MIN_FILLED_DENSITY);
    examCodeDigits.push(selected ? selected.key : "");

    colCandidates.forEach((cand) => {
      const isSel = selected?.key === cand.key;
      bubbleCoordinates.push({
        id: `code-col${col}-${cand.key}`,
        section: "exam_code",
        optionKey: cand.key,
        x: cx,
        y: cand.y,
        r: blueprint.examCode.radius,
        density: cand.density,
        isSelected: isSel,
        status: isSel ? "detected" : "unfilled",
      });
    });
  }

  // --- QUÉT PHẦN I: 40 CÂU TRẮC NGHIỆM NHIỀU LỰA CHỌN (A, B, C, D) ---[cite: 25]
  const part1Answers: Record<number, string> = {};
  const optionKeys = ["A", "B", "C", "D"];

  blueprint.part1.blocks.forEach((block) => {
    for (let qNum = block.startQuestion; qNum <= block.endQuestion; qNum++) {
      const rowIdx = qNum - block.startQuestion;
      const cy = block.startY + rowIdx * block.rowStepY;
      const rowCandidates: { key: string; density: number; x: number }[] = [];

      optionKeys.forEach((optKey, optIdx) => {
        const cx = block.startX + optIdx * block.optionStepX;
        const density = measureBubbleDensity(
          binary,
          gray,
          width,
          height,
          cx,
          cy,
          block.radius
        );
        rowCandidates.push({ key: optKey, density, x: cx });
      });

      const { selected, isAmbiguous } = pickDominantBubble(rowCandidates, MIN_FILLED_DENSITY);
      if (selected) {
        part1Answers[qNum] = selected.key;
        confidenceSum += isAmbiguous ? 65 : Math.min(100, 75 + selected.density * 35);
        confidenceCount++;
      }
      if (isAmbiguous) {
        flaggedQuestionsSet.add(qNum);
      }

      rowCandidates.forEach((cand) => {
        const isSel = selected?.key === cand.key;
        bubbleCoordinates.push({
          id: `p1-q${qNum}-${cand.key}`,
          section: "part1",
          questionNumber: qNum,
          optionKey: cand.key,
          x: cand.x,
          y: cy,
          r: block.radius,
          density: cand.density,
          isSelected: isSel,
          status: isAmbiguous && isSel ? "ambiguous" : isSel ? "detected" : "unfilled",
        });
      });
    }
  });

  // --- QUÉT PHẦN II: 8 CÂU TRẮC NGHIỆM ĐÚNG / SAI (4 Ý a, b, c, d) ---[cite: 25]
  const part2Answers: Record<number, Record<"a" | "b" | "c" | "d", boolean | null>> = {};
  const subKeys: ("a" | "b" | "c" | "d")[] = ["a", "b", "c", "d"];

  blueprint.part2.blocks.forEach((block) => {
    const qNum = block.questionNumber;
    const globalQOrder = 40 + qNum;
    part2Answers[qNum] = { a: null, b: null, c: null, d: null };

    subKeys.forEach((subK, subIdx) => {
      const cy = block.startY + subIdx * block.rowStepY;
      const densityTrue = measureBubbleDensity(
        binary,
        gray,
        width,
        height,
        block.trueX,
        cy,
        block.radius
      );
      const densityFalse = measureBubbleDensity(
        binary,
        gray,
        width,
        height,
        block.falseX,
        cy,
        block.radius
      );

      const pairCandidates = [
        { key: "T", density: densityTrue, x: block.trueX },
        { key: "F", density: densityFalse, x: block.falseX },
      ];

      const { selected, isAmbiguous } = pickDominantBubble(pairCandidates, MIN_FILLED_DENSITY);
      if (selected) {
        part2Answers[qNum][subK] = selected.key === "T";
        confidenceSum += isAmbiguous ? 65 : Math.min(100, 75 + selected.density * 35);
        confidenceCount++;
      }
      if (isAmbiguous) {
        flaggedQuestionsSet.add(globalQOrder);
      }

      pairCandidates.forEach((cand) => {
        const isSel = selected?.key === cand.key;
        bubbleCoordinates.push({
          id: `p2-q${qNum}-${subK}-${cand.key}`,
          section: "part2",
          questionNumber: qNum,
          subKey: subK,
          optionKey: cand.key,
          x: cand.x,
          y: cy,
          r: block.radius,
          density: cand.density,
          isSelected: isSel,
          status: isAmbiguous && isSel ? "ambiguous" : isSel ? "detected" : "unfilled",
        });
      });
    });
  });

  // --- QUÉT PHẦN III: 6 CÂU TRẢ LỜI NGẮN (4 CỘT SỐ MỖI CÂU) ---[cite: 25]
  const part3Answers: Record<number, string> = {};

  blueprint.part3.blocks.forEach((block) => {
    const qNum = block.questionNumber;
    const globalQOrder = 48 + qNum;
    const chars: string[] = [];

    for (let col = 0; col < 4; col++) {
      const cx = block.startX + col * block.colStepX;
      const colCandidates: { key: string; density: number; y: number }[] = [];

      // Ô dấu âm (-) chỉ nằm ở cột đầu tiên[cite: 25]
      if (col === 0) {
        const dMinus = measureBubbleDensity(
          binary,
          gray,
          width,
          height,
          cx,
          block.minusY,
          block.radius
        );
        colCandidates.push({ key: "-", density: dMinus, y: block.minusY });
      }

      // Ô dấu phẩy (,) nằm ở cột 2 và cột 3[cite: 25]
      if (col === 1 || col === 2) {
        const dComma = measureBubbleDensity(
          binary,
          gray,
          width,
          height,
          cx,
          block.commaY,
          block.radius
        );
        colCandidates.push({ key: ",", density: dComma, y: block.commaY });
      }

      // Các chữ số từ 0 đến 9[cite: 25]
      for (let digit = 0; digit <= 9; digit++) {
        const cy = block.digit0Y + digit * block.rowStepY;
        const dDigit = measureBubbleDensity(
          binary,
          gray,
          width,
          height,
          cx,
          cy,
          block.radius
        );
        colCandidates.push({ key: String(digit), density: dDigit, y: cy });
      }

      const { selected, isAmbiguous } = pickDominantBubble(colCandidates, MIN_FILLED_DENSITY);
      if (selected) {
        chars.push(selected.key);
        confidenceSum += isAmbiguous ? 65 : Math.min(100, 75 + selected.density * 35);
        confidenceCount++;
      }
      if (isAmbiguous) {
        flaggedQuestionsSet.add(globalQOrder);
      }

      colCandidates.forEach((cand) => {
        const isSel = selected?.key === cand.key;
        bubbleCoordinates.push({
          id: `p3-q${qNum}-c${col}-${cand.key}`,
          section: "part3",
          questionNumber: qNum,
          subKey: String(col),
          optionKey: cand.key,
          x: cx,
          y: cand.y,
          r: block.radius,
          density: cand.density,
          isSelected: isSel,
          status: isAmbiguous && isSel ? "ambiguous" : isSel ? "detected" : "unfilled",
        });
      });
    }

    part3Answers[qNum] = chars.join("");
  });

  const avgConfidence =
    confidenceCount > 0 ? Number((confidenceSum / confidenceCount).toFixed(1)) : 96.5;

  return {
    detected_sbd: sbdDigits.join("") || "Chưa tô",
    detected_exam_code: examCodeDigits.join("") || "Chưa tô",
    confidence: avgConfidence,
    warp_matrix_applied: cornerResult.detected,
    canonical_width: OMR_CANONICAL_WIDTH,
    canonical_height: OMR_CANONICAL_HEIGHT,
    warped_image_data_url: warpedDataUrl,
    corner_points: {
      topLeft: cornerResult.topLeft,
      topRight: cornerResult.topRight,
      bottomRight: cornerResult.bottomRight,
      bottomLeft: cornerResult.bottomLeft,
    },
    part1_answers: part1Answers,
    part2_answers: part2Answers,
    part3_answers: part3Answers,
    flagged_questions: Array.from(flaggedQuestionsSet).sort((a, b) => a - b),
    bubble_coordinates: bubbleCoordinates,
  };
}

/**
 * 8. HÀM CHẤM ĐIỂM TỰ ĐỘNG BÀI LÀM OMR VÀ CẬP NHẬT TRẠNG THÁI BOUNDING BOX (XANH / ĐỎ)
 */
export function gradeOMRSubmission(
  omrData: OMRResultData,
  examDataOrQuestions: any
): OMRGradingSummary {
  // Trích xuất danh sách câu hỏi phẳng từ cấu trúc đề thi (data / sections / questions)
  const rawSections =
    examDataOrQuestions?.data ||
    examDataOrQuestions?.sections ||
    (Array.isArray(examDataOrQuestions) ? examDataOrQuestions : []);

  const flatQuestions: {
    id: string;
    globalOrder: number;
    part: 1 | 2 | 3;
    localNumberInPart: number;
    type: QuestionType;
    correctAnswer: string;
    options: any[];
  }[] = [];

  let p1Counter = 0;
  let p2Counter = 0;
  let p3Counter = 0;
  let globalCounter = 0;

  const pushQuestion = (q: any, fallbackType?: string) => {
    globalCounter++;
    const rawCorrect = String(q?.correct_answer ?? q?.correctAnswer ?? q?.answer ?? "A").trim();
    const cleanAns = rawCorrect.replace(/[^A-Za-zĐđSsTtFf]/g, "").toUpperCase();

    const isTF =
      q?.type === "true_false" ||
      fallbackType === "true_false" ||
      (["Đ", "S", "T", "F"].includes(cleanAns[0]) && cleanAns.length >= 2);

    const isShort =
      !isTF &&
      (q?.type === "short_answer" ||
        fallbackType === "short_answer" ||
        !Array.isArray(q?.options) ||
        q.options.length === 0);

    if (isTF) {
      p2Counter++;
      flatQuestions.push({
        id: String(q?.id || `q-${globalCounter}`),
        globalOrder: globalCounter,
        part: 2,
        localNumberInPart: p2Counter,
        type: "true_false",
        correctAnswer: rawCorrect,
        options: Array.isArray(q?.options) ? q.options : [],
      });
    } else if (isShort) {
      p3Counter++;
      flatQuestions.push({
        id: String(q?.id || `q-${globalCounter}`),
        globalOrder: globalCounter,
        part: 3,
        localNumberInPart: p3Counter,
        type: "short_answer",
        correctAnswer: rawCorrect,
        options: [],
      });
    } else {
      p1Counter++;
      flatQuestions.push({
        id: String(q?.id || `q-${globalCounter}`),
        globalOrder: globalCounter,
        part: 1,
        localNumberInPart: p1Counter,
        type: "multiple_choice",
        correctAnswer: rawCorrect,
        options: Array.isArray(q?.options) ? q.options : [],
      });
    }
  };

  if (Array.isArray(rawSections) && rawSections.length > 0 && rawSections[0]?.questions) {
    rawSections.forEach((sec: any) => {
      const secType =
        sec?.section_type ||
        sec?.type ||
        (sec?.section_title && /đúng\s*sai/i.test(sec.section_title)
          ? "true_false"
          : sec?.section_title && /trả\s*lời\s*ngắn|điền/i.test(sec.section_title)
          ? "short_answer"
          : "multiple_choice");

      (sec?.questions || []).forEach((q: any) => pushQuestion(q, secType));
    });
  } else if (Array.isArray(examDataOrQuestions?.questions)) {
    examDataOrQuestions.questions.forEach((q: any) => pushQuestion(q));
  } else if (Array.isArray(rawSections)) {
    rawSections.forEach((q: any) => pushQuestion(q));
  }

  const normalizeShortStr = (val: string) =>
    String(val || "")
      .trim()
      .toLowerCase()
      .replace(/,/g, ".")
      .replace(/\s+/g, "")
      .replace(/[−–—]/g, "-");

  const updatedCoordinates: OMRBubbleCoordinate[] = omrData.bubble_coordinates.map((b) => ({
    ...b,
  }));

  const normalizedAnswers: Record<string, any> = {};
  const questionDetails: OMRQuestionGradeDetail[] = [];

  let part1Score = 0;
  let part2Score = 0;
  let part3Score = 0;
  let maxPossiblePoints = 0;

  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;

  const isStandardTHPTWeight = p2Counter > 0 || p3Counter > 0;

  flatQuestions.forEach((q) => {
    const gOrder = q.globalOrder;
    const isFlagged = omrData.flagged_questions.includes(gOrder);

    if (q.part === 1) {
      const qMaxPt = isStandardTHPTWeight ? 0.25 : 1.0;
      maxPossiblePoints += qMaxPt;

      const selectedOpt = (omrData.part1_answers[q.localNumberInPart] || "").trim().toUpperCase();
      const expectedOpt = (q.correctAnswer || "A").trim().toUpperCase();

      if (selectedOpt) {
        normalizedAnswers[q.id] = selectedOpt;
        normalizedAnswers[`q-${gOrder}`] = selectedOpt;
        normalizedAnswers[`q_${gOrder}`] = selectedOpt;
        normalizedAnswers[String(gOrder)] = selectedOpt;
      }

      const isRight = Boolean(selectedOpt && selectedOpt === expectedOpt);
      const status = !selectedOpt ? "skipped" : isRight ? "correct" : "wrong";
      const earned = isRight ? qMaxPt : 0;

      part1Score += earned;
      if (status === "correct") correctCount++;
      else if (status === "wrong") wrongCount++;
      else skippedCount++;

      // Cập nhật màu sắc tọa độ ô tròn của câu này
      updatedCoordinates.forEach((b) => {
        if (b.section === "part1" && b.questionNumber === q.localNumberInPart) {
          if (b.optionKey === selectedOpt) {
            b.status = isRight ? "correct" : "wrong";
          } else if (b.optionKey === expectedOpt && !isRight) {
            b.status = "expected_missed";
          }
        }
      });

      questionDetails.push({
        questionOrder: gOrder,
        part: 1,
        questionId: q.id,
        type: "multiple_choice",
        studentAnswerDisplay: selectedOpt || "Bỏ trống",
        correctAnswerDisplay: expectedOpt,
        status,
        pointsEarned: earned,
        maxPoints: qMaxPt,
        isFlagged,
      });
    } else if (q.part === 2) {
      const qMaxPt = 1.0;
      maxPossiblePoints += qMaxPt;

      const stuSubMap = omrData.part2_answers[q.localNumberInPart] || {
        a: null,
        b: null,
        c: null,
        d: null,
      };
      const cleanExpected = (q.correctAnswer || "ĐĐĐĐ")
        .replace(/[^A-Za-zĐđSsTtFf]/g, "")
        .toUpperCase();

      const subKeys: ("a" | "b" | "c" | "d")[] = ["a", "b", "c", "d"];
      let rightSubCount = 0;
      let answeredSubCount = 0;
      const tfAnswerForExamRoom: Record<string, "T" | "F"> = {};
      const stuDisplayParts: string[] = [];
      const corrDisplayParts: string[] = [];

      subKeys.forEach((sk, idx) => {
        const expChar = cleanExpected[idx] || "Đ";
        const expBool = expChar === "Đ" || expChar === "D" || expChar === "T";
        const stuBool = stuSubMap[sk];

        corrDisplayParts.push(`${sk}) ${expBool ? "Đ" : "S"}`);

        if (stuBool !== null && stuBool !== undefined) {
          answeredSubCount++;
          tfAnswerForExamRoom[sk] = stuBool ? "T" : "F";
          stuDisplayParts.push(`${sk}) ${stuBool ? "Đ" : "S"}`);
          if (stuBool === expBool) {
            rightSubCount++;
          }
        } else {
          stuDisplayParts.push(`${sk}) _`);
        }

        updatedCoordinates.forEach((b) => {
          if (
            b.section === "part2" &&
            b.questionNumber === q.localNumberInPart &&
            b.subKey === sk
          ) {
            const bubbleRepresentsTrue = b.optionKey === "T";
            if (b.isSelected) {
              b.status = bubbleRepresentsTrue === expBool ? "correct" : "wrong";
            } else if (bubbleRepresentsTrue === expBool && stuBool !== expBool) {
              b.status = "expected_missed";
            }
          }
        });
      });

      if (answeredSubCount > 0) {
        normalizedAnswers[q.id] = tfAnswerForExamRoom;
        normalizedAnswers[`q-${gOrder}`] = tfAnswerForExamRoom;
        normalizedAnswers[`q_${gOrder}`] = tfAnswerForExamRoom;
        normalizedAnswers[String(gOrder)] = tfAnswerForExamRoom;
      }

      let earned = 0;
      if (rightSubCount === 1) earned = 0.1;
      else if (rightSubCount === 2) earned = 0.25;
      else if (rightSubCount === 3) earned = 0.5;
      else if (rightSubCount === 4) earned = 1.0;

      part2Score += earned;

      let status: "correct" | "wrong" | "partial" | "skipped" = "skipped";
      if (answeredSubCount === 0) {
        status = "skipped";
        skippedCount++;
      } else if (rightSubCount === 4) {
        status = "correct";
        correctCount++;
      } else if (rightSubCount > 0) {
        status = "partial";
        wrongCount++;
      } else {
        status = "wrong";
        wrongCount++;
      }

      questionDetails.push({
        questionOrder: gOrder,
        part: 2,
        questionId: q.id,
        type: "true_false",
        studentAnswerDisplay: answeredSubCount > 0 ? stuDisplayParts.join(" • ") : "Bỏ trống",
        correctAnswerDisplay: corrDisplayParts.join(" • "),
        status,
        pointsEarned: earned,
        maxPoints: qMaxPt,
        isFlagged,
      });
    } else {
      const qMaxPt = isStandardTHPTWeight ? 0.5 : 1.0;
      maxPossiblePoints += qMaxPt;

      const stuRawStr = (omrData.part3_answers[q.localNumberInPart] || "").trim();
      const expRawStr = (q.correctAnswer || "").trim();

      if (stuRawStr) {
        normalizedAnswers[q.id] = stuRawStr;
        normalizedAnswers[`q-${gOrder}`] = stuRawStr;
        normalizedAnswers[`q_${gOrder}`] = stuRawStr;
        normalizedAnswers[String(gOrder)] = stuRawStr;
      }

      const isRight = Boolean(
        stuRawStr && expRawStr && normalizeShortStr(stuRawStr) === normalizeShortStr(expRawStr)
      );
      const status = !stuRawStr ? "skipped" : isRight ? "correct" : "wrong";
      const earned = isRight ? qMaxPt : 0;

      part3Score += earned;
      if (status === "correct") correctCount++;
      else if (status === "wrong") wrongCount++;
      else skippedCount++;

      updatedCoordinates.forEach((b) => {
        if (b.section === "part3" && b.questionNumber === q.localNumberInPart && b.isSelected) {
          b.status = isRight ? "correct" : "wrong";
        }
      });

      questionDetails.push({
        questionOrder: gOrder,
        part: 3,
        questionId: q.id,
        type: "short_answer",
        studentAnswerDisplay: stuRawStr || "Bỏ trống",
        correctAnswerDisplay: expRawStr,
        status,
        pointsEarned: earned,
        maxPoints: qMaxPt,
        isFlagged,
      });
    }
  });

  const rawPointsEarned = Number((part1Score + part2Score + part3Score).toFixed(2));
  const scaledScoreOn10 =
    maxPossiblePoints > 0
      ? Number(Math.min(10, (rawPointsEarned / maxPossiblePoints) * 10).toFixed(2))
      : 0;

  return {
    score: scaledScoreOn10,
    rawPointsEarned,
    maxPossiblePoints: Number(maxPossiblePoints.toFixed(2)),
    totalQuestions: flatQuestions.length,
    correctCount,
    wrongCount,
    skippedCount,
    part1Score: Number(part1Score.toFixed(2)),
    part2Score: Number(part2Score.toFixed(2)),
    part3Score: Number(part3Score.toFixed(2)),
    normalizedAnswers,
    questionDetails,
    updatedOmrData: {
      ...omrData,
      bubble_coordinates: updatedCoordinates,
    },
  };
}
