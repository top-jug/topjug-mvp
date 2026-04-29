import { MouseEvent } from 'react';

interface RecordCountButtonProps {
  value: number;
  colorClassName: string;
  onChange: (delta: number) => void;
}

export default function RecordCountButton({ value, colorClassName, onChange }: RecordCountButtonProps) {
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

  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    const timer = window.setTimeout(() => {
      button.dataset.longPress = 'true';
      onChange(-1);
    }, 1000);
    button.dataset.timer = timer.toString();
  };

  const handleMouseUp = (event: MouseEvent<HTMLButtonElement>) => {
    clearTimer(event.currentTarget);
  };

  const handleMouseLeave = (event: MouseEvent<HTMLButtonElement>) => {
    clearTimer(event.currentTarget);
    event.currentTarget.dataset.longPress = 'false';
  };

  return (
    <button
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={(event) => event.preventDefault()}
      className={`min-w-[60px] h-10 rounded-lg text-white text-[18px] font-bold transition-colors ${colorClassName}`}
    >
      {value}
    </button>
  );
}
