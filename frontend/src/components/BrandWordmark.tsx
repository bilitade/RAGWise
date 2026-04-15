type BrandWordmarkProps = {
  /** When set, the wordmark is a button (e.g. navigate home). */
  onClick?: () => void;
  className?: string;
};

export default function BrandWordmark({ onClick, className = "" }: BrandWordmarkProps) {
  const inner = (
    <>
      <span className="brand-mark-core">RAG</span>
      <span className="brand-mark-accent">Wise</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`brand-mark cursor-pointer rounded-md border-0 bg-transparent p-0 text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_55%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${className}`}
        aria-label="Home"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={`brand-mark ${className}`} aria-label="RAGWise">
      {inner}
    </div>
  );
}
