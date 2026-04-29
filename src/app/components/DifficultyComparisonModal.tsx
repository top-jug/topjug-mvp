import { useState } from 'react';
import CenteredModalShell from './overlay/CenteredModalShell';

interface DifficultyComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DifficultyComparisonModal({ isOpen, onClose }: DifficultyComparisonModalProps) {
  const [hoveredGrade, setHoveredGrade] = useState<string | null>(null);
  const [selectedLeftGym, setSelectedLeftGym] = useState('더클라임 연남');
  const [selectedRightGym, setSelectedRightGym] = useState('클라이밍랩코 강남');
  const [showLeftDropdown, setShowLeftDropdown] = useState(false);
  const [showRightDropdown, setShowRightDropdown] = useState(false);

  const gyms = [
    {
      name: '더클라임 연남',
      grades: [
        { vGrade: 'V10', color: 'bg-neutral-900', label: '검' },
        { vGrade: 'V9', color: 'bg-purple-600', label: '보' },
        { vGrade: 'V8', color: 'bg-indigo-600', label: '남' },
        { vGrade: 'V7', color: 'bg-blue-500', label: '파' },
        { vGrade: 'V6', color: 'bg-green-500', label: '초' },
        { vGrade: 'V5', color: 'bg-yellow-400', label: '노' },
        { vGrade: 'V4', color: 'bg-orange-500', label: '주' },
        { vGrade: 'V3', color: 'bg-red-500', label: '빨' },
        { vGrade: 'V2', color: 'bg-red-500', label: '빨' },
        { vGrade: 'V1', color: 'bg-red-500', label: '빨' },
        { vGrade: 'V0', color: 'bg-red-500', label: '빨' },
      ]
    },
    {
      name: '클라이밍랩코 강남',
      grades: [
        { vGrade: 'V10', color: 'bg-neutral-400', label: '회' },
        { vGrade: 'V9', color: 'bg-neutral-900', label: '검' },
        { vGrade: 'V8', color: 'bg-purple-600', label: '보' },
        { vGrade: 'V7', color: 'bg-pink-500', label: '핑' },
        { vGrade: 'V6', color: 'bg-red-500', label: '빨' },
        { vGrade: 'V5', color: 'bg-green-500', label: '초' },
        { vGrade: 'V4', color: 'bg-yellow-400', label: '노' },
        { vGrade: 'V3', color: 'bg-white', label: '흰', border: true },
        { vGrade: 'V2', color: 'bg-white', label: '흰', border: true },
        { vGrade: 'V1', color: 'bg-white', label: '흰', border: true },
        { vGrade: 'V0', color: 'bg-white', label: '흰', border: true },
      ]
    },
    {
      name: '피커스 홀딩',
      grades: [
        { vGrade: 'V10', color: 'bg-neutral-900', label: '검' },
        { vGrade: 'V9', color: 'bg-purple-600', label: '보' },
        { vGrade: 'V8', color: 'bg-blue-500', label: '파' },
        { vGrade: 'V7', color: 'bg-green-500', label: '초' },
        { vGrade: 'V6', color: 'bg-lime-500', label: '연초' },
        { vGrade: 'V5', color: 'bg-yellow-400', label: '노' },
        { vGrade: 'V4', color: 'bg-orange-500', label: '주' },
        { vGrade: 'V3', color: 'bg-red-500', label: '빨' },
        { vGrade: 'V2', color: 'bg-pink-400', label: '핑' },
        { vGrade: 'V1', color: 'bg-white', label: '흰', border: true },
        { vGrade: 'V0', color: 'bg-white', label: '흰', border: true },
      ]
    }
  ];

  const vGrades = ['V10', 'V9', 'V8', 'V7', 'V6', 'V5', 'V4', 'V3', 'V2', 'V1', 'V0'];

  const leftGym = gyms.find(g => g.name === selectedLeftGym) || gyms[0];
  const rightGym = gyms.find(g => g.name === selectedRightGym) || gyms[1];

  if (!isOpen) return null;

  return (
    <CenteredModalShell onClose={() => {
      onClose();
      setHoveredGrade(null);
    }} panelClassName="bg-white rounded-3xl p-6 w-full max-w-[400px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">난이도 비교</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-neutral-100 rounded-full transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Gym Selectors */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="relative">
            <button
              onClick={() => {
                setShowLeftDropdown(!showLeftDropdown);
                setShowRightDropdown(false);
              }}
              className="w-full border-2 border-dashed border-neutral-300 rounded-xl p-3 hover:border-neutral-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-neutral-700">{selectedLeftGym}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </button>
            {showLeftDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-xl shadow-lg z-10 overflow-hidden">
                {gyms.map((gym) => (
                  <button
                    key={gym.name}
                    onClick={() => {
                      setSelectedLeftGym(gym.name);
                      setShowLeftDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-[14px] hover:bg-neutral-50 transition-colors ${
                      selectedLeftGym === gym.name ? 'bg-blue-50 text-blue-600 font-medium' : 'text-neutral-700'
                    }`}
                  >
                    {gym.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => {
                setShowRightDropdown(!showRightDropdown);
                setShowLeftDropdown(false);
              }}
              className="w-full border-2 border-dashed border-neutral-300 rounded-xl p-3 hover:border-neutral-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-neutral-700">{selectedRightGym}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </button>
            {showRightDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-xl shadow-lg z-10 overflow-hidden">
                {gyms.map((gym) => (
                  <button
                    key={gym.name}
                    onClick={() => {
                      setSelectedRightGym(gym.name);
                      setShowRightDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-[14px] hover:bg-neutral-50 transition-colors ${
                      selectedRightGym === gym.name ? 'bg-blue-50 text-blue-600 font-medium' : 'text-neutral-700'
                    }`}
                  >
                    {gym.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Grade Comparison */}
        <div className="space-y-2 mb-6">
          {vGrades.map((vGrade, index) => {
            const leftGradeData = leftGym.grades.find(g => g.vGrade === vGrade);
            const rightGradeData = rightGym.grades.find(g => g.vGrade === vGrade);
            const isHovered = hoveredGrade === vGrade;

            return (
              <div key={index} className="grid grid-cols-[1fr_80px_1fr] gap-2 items-center">
                {/* Left Color */}
                {leftGradeData && (
                  <div
                    onMouseEnter={() => setHoveredGrade(vGrade)}
                    onMouseLeave={() => setHoveredGrade(null)}
                    className={`${leftGradeData.color} rounded-xl h-10 transition-all cursor-pointer ${
                      isHovered ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                    } ${leftGradeData.border ? 'border-2 border-neutral-300' : ''}`}
                  />
                )}

                {/* Center V-Grade with lines */}
                <div className="flex items-center justify-center relative">
                  <div className="absolute left-0 w-6 border-t-2 border-dashed border-blue-300"></div>
                  <div className="bg-white px-2 py-1.5 text-[13px] font-medium text-neutral-700 relative z-10">
                    {vGrade}
                  </div>
                  <div className="absolute right-0 w-6 border-t-2 border-dashed border-blue-300"></div>
                </div>

                {/* Right Color */}
                {rightGradeData && (
                  <div
                    onMouseEnter={() => setHoveredGrade(vGrade)}
                    onMouseLeave={() => setHoveredGrade(null)}
                    className={`${rightGradeData.color} rounded-xl h-10 transition-all cursor-pointer ${
                      isHovered ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                    } ${rightGradeData.border ? 'border-2 border-neutral-300' : ''}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Guide */}
        <div className="bg-neutral-50 rounded-xl p-4">
          <h4 className="text-[12px] font-bold text-neutral-700 mb-2">GUIDE</h4>
          <p className="text-[11px] text-neutral-600 leading-relaxed">
            관찰된 실제 체감 점선 간의 체감 난이도 조절성을 나타냅니다. (Straight lines indicate direct equivalence).
          </p>
        </div>
    </CenteredModalShell>
  );
}
