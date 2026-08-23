import { ClimbingRecord } from '../../entities/record/types';
import { getRecordTotals } from './record-summary';

export function createRecordShareImage(record: ClimbingRecord) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Canvas is not available');

  const totals = getRecordTotals(record);
  const gradient = context.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, '#121212');
  gradient.addColorStop(0.55, '#241A45');
  gradient.addColorStop(1, '#795CFF');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1080, 1350);

  context.fillStyle = '#A7F432';
  context.beginPath();
  context.arc(920, 180, 220, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#FF6B9D';
  context.beginPath();
  context.arc(100, 1260, 260, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#FFFFFF';
  context.font = '700 46px sans-serif';
  context.fillText('TOPJUG / CLIMB LOG', 72, 100);
  context.font = '900 92px sans-serif';
  context.fillText(record.gym, 72, 310);
  context.font = '500 34px sans-serif';
  context.fillStyle = 'rgba(255,255,255,0.72)';
  context.fillText(`${record.date}  /  ${record.duration}`, 76, 375);

  context.fillStyle = 'rgba(255,255,255,0.10)';
  context.beginPath();
  context.roundRect(64, 470, 952, 520, 52);
  context.fill();

  const stats = [
    ['SEND', String(totals.success)],
    ['TRY', String(totals.attempt)],
    ['FEEL', `${record.rating}/5`],
  ];

  stats.forEach(([label, value], index) => {
    const x = 115 + index * 315;
    context.fillStyle = '#FFFFFF';
    context.font = '900 104px sans-serif';
    context.fillText(value, x, 700);
    context.fillStyle = 'rgba(255,255,255,0.58)';
    context.font = '700 30px sans-serif';
    context.fillText(label, x, 755);
  });

  context.fillStyle = '#A7F432';
  context.font = '800 42px sans-serif';
  context.fillText(record.mode === 'easy' ? 'EASY MODE' : 'SECTOR MODE', 112, 900);
  context.fillStyle = '#FFFFFF';
  context.font = '700 34px sans-serif';
  context.fillText(record.passLabel, 112, 955);
  context.font = '900 58px sans-serif';
  context.fillText('KEEP MOVING.', 72, 1190);
  context.fillStyle = 'rgba(255,255,255,0.62)';
  context.font = '500 28px sans-serif';
  context.fillText('topjug.kr', 76, 1245);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image creation failed'))), 'image/png');
  });
}
