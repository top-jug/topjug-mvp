import { PropsWithChildren } from 'react';

export default function DeviceFrame({ children }: PropsWithChildren) {
  return (
    <div className="size-full bg-neutral-50 flex items-center justify-center">
      <div className="w-[393px] h-[852px] bg-white shadow-2xl rounded-[60px] overflow-hidden relative">
        {children}
      </div>
    </div>
  );
}
