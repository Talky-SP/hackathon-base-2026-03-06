import { useState, useEffect, useRef } from 'react';

type Props = {
  message: string;
};

export default function StatusIndicator({ message }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    startRef.current = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-3 py-2 max-w-2xl">
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#f2764b' }} />
        <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#f2764b', animationDelay: '0.2s' }} />
        <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#f2764b', animationDelay: '0.4s' }} />
      </div>
      <span className="text-sm text-gray-500 truncate flex-1 min-w-0">{message}</span>
      <span className="text-[10px] tabular-nums text-gray-300 shrink-0">{elapsed}s</span>
    </div>
  );
}
