type Props = {
  message: string;
};

export default function StatusIndicator({ message }: Props) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#f2764b' }} />
        <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#f2764b', animationDelay: '0.2s' }} />
        <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#f2764b', animationDelay: '0.4s' }} />
      </div>
      <span className="text-sm text-gray-500">{message}</span>
    </div>
  );
}
