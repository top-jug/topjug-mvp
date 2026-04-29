interface RecordRatingCardProps {
  rating: number | null;
  onChange: (value: number) => void;
}

export default function RecordRatingCard({ rating, onChange }: RecordRatingCardProps) {
  return (
    <div className="py-4 rating-section">
      <div className="bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl p-4 text-white text-center">
        <h3 className="text-[14px] font-medium mb-2">오늘의 암장 난이도는 어떠셨나요?</h3>
        <div className="flex items-center justify-center gap-1.5 mb-2">
          {[1, 2, 3, 4, 5].map((starNum) => {
            const isFilled = rating !== null && starNum <= Math.floor(rating);
            const isHalf = rating !== null && starNum === Math.ceil(rating) && rating % 1 !== 0;

            return (
              <div
                key={starNum}
                className="relative cursor-pointer"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const x = event.clientX - rect.left;
                  onChange(x < rect.width / 2 ? starNum - 0.5 : starNum);
                }}
              >
                {isHalf ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <defs>
                      <linearGradient id={`half-${starNum}`}>
                        <stop offset="50%" stopColor="currentColor" />
                        <stop offset="50%" stopColor="transparent" />
                      </linearGradient>
                    </defs>
                    <path fill={`url(#half-${starNum})`} d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                  </svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill={isFilled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
        <div className="inline-block bg-white text-blue-500 px-4 py-1.5 rounded-full text-[13px] font-bold">
          {rating !== null ? `${rating}/5` : '/ 5'}
        </div>
      </div>
    </div>
  );
}
