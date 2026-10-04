import { Link } from "react-router-dom";

export type ReleaseStatus = "DRAFT" | "ANALYZED" | "IN_REVIEW" | "FINAL";

interface Props {
  releaseId: string;
  status: ReleaseStatus;
}

const STATUS_LEVELS: Record<ReleaseStatus, number> = {
  DRAFT: 0,
  ANALYZED: 1,
  IN_REVIEW: 2,
  FINAL: 3,
};

const STEPS = [
  { id: "PACKAGE", label: "Package", path: "", minStatus: 0 },
  { id: "ANALYSIS", label: "Analysis", path: "/analysis", minStatus: 0 },
  { id: "REVIEW", label: "Review", path: "/review", minStatus: 1 },
  { id: "FINAL", label: "Final Brief", path: "/final", minStatus: 2 },
];

export default function LifecycleStepper({ releaseId, status }: Props) {
  const currentLevel = STATUS_LEVELS[status];

  return (
    <div className="mb-8 p-6 sm:px-10 rounded-2xl bg-surface-900/40 border border-surface-800/60 backdrop-blur-xl shadow-2xl relative overflow-hidden">
      <div className="flex items-center justify-between relative z-10">
        {/* Lines Container */}
        <div className="absolute left-[20px] right-[20px] top-[20px] -translate-y-1/2 h-1.5">
          {/* Background Line */}
          <div className="absolute inset-0 bg-surface-800/80 rounded-full shadow-inner" />
          
          {/* Active Line */}
          <div 
            className="absolute left-0 top-0 h-full bg-primary-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(currentLevel / 3) * 100}%` }}
          />
        </div>

        {STEPS.map((step, index) => {
          const isUnlocked = currentLevel >= step.minStatus;
          const isCompleted = currentLevel > index || (status === "FINAL" && index === 3);
          const stepUrl = `/releases/${releaseId}${step.path}`;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-3 group">
              {isUnlocked ? (
                <Link
                  to={stepUrl}
                  className="relative flex items-center justify-center outline-none"
                >
                  <div
                    className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-[3px] transition-all duration-300
                      ${isCompleted 
                        ? "bg-surface-950 border-primary-500 text-primary-400 group-hover:border-primary-400" 
                        : "bg-surface-950 border-surface-700 text-surface-400 group-hover:border-surface-500 group-hover:text-surface-300"
                      }`}
                  >
                    {isCompleted ? (
                      <svg className="w-5 h-5 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                </Link>
              ) : (
                <div className="relative flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-[3px] bg-surface-950 border-surface-800 text-surface-600 cursor-not-allowed shadow-inner opacity-60">
                    {index + 1}
                  </div>
                </div>
              )}
              <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors duration-300 ${isUnlocked ? "text-surface-400" : "text-surface-600"}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
