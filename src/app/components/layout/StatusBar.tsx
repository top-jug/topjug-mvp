export default function StatusBar() {
  return (
    <div className="h-11 bg-white flex items-center justify-between px-6 pt-3">
      <span className="text-[15px] font-semibold">9:41</span>
      <div className="flex gap-1.5 items-center">
        <svg width="17" height="12" viewBox="0 0 17 12" fill="black">
          <path d="M0 2.5C0 1.67 0.67 1 1.5 1h1C3.33 1 4 1.67 4 2.5v7C4 10.33 3.33 11 2.5 11h-1C0.67 11 0 10.33 0 9.5v-7zM5.5 4C5.5 3.17 6.17 2.5 7 2.5h1c0.83 0 1.5 0.67 1.5 1.5v4c0 0.83-0.67 1.5-1.5 1.5H7c-0.83 0-1.5-0.67-1.5-1.5V4zM11 0.5C11 0.22 11.22 0 11.5 0h1c0.28 0 0.5 0.22 0.5 0.5v11c0 0.28-0.22 0.5-0.5 0.5h-1c-0.28 0-0.5-0.22-0.5-0.5v-11z" />
        </svg>
        <svg width="17" height="12" viewBox="0 0 17 12" fill="black">
          <path d="M1 6c0-2.76 2.24-5 5-5 1.86 0 3.5 1.01 4.36 2.5C11.14 2.01 12.78 1 14.64 1c2.76 0 5 2.24 5 5s-4.36 5-4.36 5S10.36 11 10.36 6s-2.24-5-5-5S0.36 3.24 0.36 6 5 11 5 11 1 9 1 6z" />
        </svg>
        <div className="relative">
          <div className="w-[24px] h-[11px] border-[1.5px] border-black rounded-[2.5px]"></div>
          <div className="absolute right-[-2px] top-[3px] w-[1.5px] h-[5px] bg-black rounded-r-[1px]"></div>
        </div>
      </div>
    </div>
  );
}
