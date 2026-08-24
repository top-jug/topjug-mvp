import { MouseEvent, PointerEvent } from 'react';

interface RecordCountButtonProps {
  value: number;
  colorClassName: string;
  onChange: (delta: number) => void;
  disabled?: boolean;
}

export default function RecordCountButton({ value, colorClassName, onChange, disabled = false }: RecordCountButtonProps) {
  const clearTimer = (button: HTMLButtonElement) => {
    const timer = button.dataset.timer;
    if (timer) {
      clearTimeout(parseInt(timer, 10));
    }
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const isLongPress = event.currentTarget.dataset.longPress === 'true';
    if (!isLongPress) {
      onChange(1);
    }
    event.currentTarget.dataset.longPress = 'false';
  };

  const handlePressStart = (button: HTMLButtonElement) => {
    clearTimer(button);
    button.dataset.longPress = 'false';
    button.dataset.pointerDown = 'true';
    button.dataset.timer = window.setTimeout(() => {
      button.dataset.longPress = 'true';
      onChange(-1);
    }, 700).toString();
  };

  const handlePressEnd = (button: HTMLButtonElement) => {
    clearTimer(button);
    button.dataset.pointerDown = 'false';
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    button.setPointerCapture?.(event.pointerId);
    handlePressStart(button);
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    handlePressEnd(event.currentTarget);
  };

  const handlePointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    handlePressEnd(event.currentTarget);
    event.currentTarget.dataset.longPress = 'false';
  };

  return (
    <button
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
      onContextMenu={(event) => event.preventDefault()}
      disabled={disabled}
      className={`min-w-[60px] h-10 rounded-lg text-white text-[18px] font-bold transition-colors touch-manipulation select-none disabled:opacity-50 ${colorClassName}`}
    >
      {value}
    </button>
  );
}
