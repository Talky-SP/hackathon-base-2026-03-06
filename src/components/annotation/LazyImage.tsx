import { useState, useEffect, useRef, type ReactNode } from 'react';

interface LazyImageProps {
  src: string;
  alt?: string;
  className?: string;
  scrollRoot?: Element | null;
  rootMargin?: string;
  fallback: ReactNode;
}

export default function LazyImage({
  src,
  alt = '',
  className,
  scrollRoot,
  rootMargin = '150px',
  fallback,
}: LazyImageProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  const placeholderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = placeholderRef.current;
    if (!el || isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        root: scrollRoot ?? null,
        rootMargin,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot, rootMargin, isVisible]);

  if (hasError) {
    return <>{fallback}</>;
  }

  if (!isVisible) {
    return <div ref={placeholderRef} className={className} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}
