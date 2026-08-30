import { ClimbingRecord } from '../../entities/record/types';
import { createRecordShareModel, RecordShareOptions, ShareDifficultySummary } from './record-share-model';

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;
const INK_COLOR = '#171717';

export async function createRecordShareImage(record: ClimbingRecord, options: RecordShareOptions) {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Canvas is not available');

  const model = createRecordShareModel(record, options);
  const brandIcon = await loadBrandIcon();

  context.fillStyle = '#F5F7FA';
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  context.drawImage(brandIcon, 70, 55, 68, 68);
  context.fillStyle = INK_COLOR;
  context.font = '900 32px Pretendard, system-ui, sans-serif';
  context.textAlign = 'left';
  context.fillText('TOPJUG', 160, 101);
  context.fillStyle = '#A3A3A3';
  context.font = '700 20px Pretendard, system-ui, sans-serif';
  context.textAlign = 'right';
  context.fillText('CLIMB LOG', 1010, 100);

  context.fillStyle = '#2563EB';
  context.fillRect(70, 170, 8, 120);
  context.fillStyle = INK_COLOR;
  context.textAlign = 'left';
  drawFittedText(context, record.gym, 108, 220, 902, 56, 36, 900);
  context.fillStyle = '#A3A3A3';
  context.font = '600 27px Pretendard, system-ui, sans-serif';
  context.fillText(`${record.date}  ·  ${model.durationLabel}`, 108, 275);

  drawRoundRect(context, 70, 330, 940, 145, 36, '#FFFFFF', '#EEEEEE');
  drawDivider(context, 383, 350, 383, 455);
  drawDivider(context, 697, 350, 697, 455);
  drawStat(context, '완등', String(model.totals.success), 226, 375);
  drawStat(context, '도전', String(model.totals.attempt), 540, 375);
  drawHighestDifficulty(context, model.highestCompletedDifficulty, 854, 375);

  const difficultyCardHeight = 525;
  drawRoundRect(context, 70, 500, 940, difficultyCardHeight, 36, '#FFFFFF', '#EEEEEE');
  context.fillStyle = INK_COLOR;
  context.font = '900 31px Pretendard, system-ui, sans-serif';
  context.textAlign = 'left';
  context.fillText('난이도별 기록', 120, 563);
  if (model.difficulties.length > 0) {
    const rowAreaTop = 600;
    const rowAreaHeight = 400;
    const rowHeight = rowAreaHeight / model.difficulties.length;
    const rowFontSize = getDifficultyRowFontSize(model.difficulties.length);
    const dotRadius = getDifficultyDotRadius(model.difficulties.length);

    model.difficulties.forEach((difficulty, index) => {
      const y = rowAreaTop + (index + 0.5) * rowHeight + rowFontSize * 0.34;
      drawDifficultyRow(context, difficulty, y, rowFontSize, dotRadius);
    });
  } else {
    context.fillStyle = '#A3A3A3';
    context.font = '500 25px Pretendard, system-ui, sans-serif';
    context.textAlign = 'left';
    context.fillText('선택한 난이도가 없습니다.', 120, 675);
  }

  if (model.comment) {
    const commentY = 1049;
    drawRoundRect(context, 70, commentY, 940, 110, 28, '#FFFFFF', '#EEEEEE');
    context.fillStyle = INK_COLOR;
    context.font = '900 31px Pretendard, system-ui, sans-serif';
    context.textAlign = 'left';
    context.fillText('한줄평', 112, commentY + 35);
    context.fillStyle = '#404040';
    drawFittedText(context, `"${model.comment}"`, 112, commentY + 80, 856, 35, 24, 700);
  }

  context.textAlign = 'left';

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image creation failed'))), 'image/png');
  });
}

function loadBrandIcon() {
  const image = new Image();
  image.src = '/icons/icon-192.png';
  return image.decode().then(() => image);
}

function drawStat(context: CanvasRenderingContext2D, label: string, value: string, x: number, y: number) {
  context.textAlign = 'center';
  context.fillStyle = '#737373';
  context.font = '600 23px Pretendard, system-ui, sans-serif';
  context.fillText(label, x, y);
  context.fillStyle = INK_COLOR;
  context.font = '900 50px Pretendard, system-ui, sans-serif';
  context.fillText(value, x, y + 45);
}

function drawHighestDifficulty(
  context: CanvasRenderingContext2D,
  difficulty: ShareDifficultySummary | undefined,
  x: number,
  y: number,
) {
  context.textAlign = 'center';
  context.fillStyle = '#737373';
  context.font = '600 23px Pretendard, system-ui, sans-serif';
  context.fillText('최고 난이도', x, y);

  if (!difficulty) {
    context.fillStyle = INK_COLOR;
    context.font = '900 50px Pretendard, system-ui, sans-serif';
    context.fillText('-', x, y + 45);
    return;
  }

  drawColorCircle(context, x - 38, y + 31, 18, difficulty.colorHex);
  context.fillStyle = INK_COLOR;
  context.font = '900 38px Pretendard, system-ui, sans-serif';
  context.textAlign = 'left';
  context.fillText(difficulty.grade, x - 10, y + 44);
}

function drawDifficultyRow(
  context: CanvasRenderingContext2D,
  difficulty: ShareDifficultySummary,
  y: number,
  fontSize: number,
  dotRadius: number,
) {
  drawColorCircle(context, 140, y - fontSize * 0.34, dotRadius, difficulty.colorHex);

  context.fillStyle = INK_COLOR;
  context.font = `900 ${fontSize}px Pretendard, system-ui, sans-serif`;
  context.textAlign = 'left';
  context.fillText(difficulty.grade, 180, y);
  context.textAlign = 'left';
  context.font = `600 ${fontSize}px Pretendard, system-ui, sans-serif`;
  context.fillStyle = '#737373';
  context.fillText('완등', 650, y);
  context.fillText('도전', 830, y);
  context.fillStyle = INK_COLOR;
  context.font = `800 ${fontSize}px Pretendard, system-ui, sans-serif`;
  context.fillText(String(difficulty.success), 720, y);
  context.fillText(String(difficulty.attempt), 900, y);
}

function getDifficultyRowFontSize(count: number) {
  if (count <= 1) return 40;
  if (count === 2) return 36;
  if (count === 3) return 33;
  if (count === 4) return 30;
  return 27;
}

function getDifficultyDotRadius(count: number) {
  if (count <= 1) return 28;
  if (count <= 3) return 24;
  return 20;
}

function drawRoundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 2;
    context.stroke();
  }
}

function drawDivider(context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.strokeStyle = '#F0F0F0';
  context.lineWidth = 2;
  context.stroke();
}

function drawColorCircle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
) {
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(0,0,0,0.16)';
  context.lineWidth = 2;
  context.stroke();
}

function drawFittedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  initialSize: number,
  minimumSize: number,
  weight: number,
) {
  let fontSize = initialSize;

  while (fontSize > minimumSize) {
    context.font = `${weight} ${fontSize}px Pretendard, system-ui, sans-serif`;
    if (context.measureText(text).width <= maxWidth) break;
    fontSize -= 2;
  }

  context.fillText(text, x, y, maxWidth);
}
