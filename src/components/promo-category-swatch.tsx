export function PromoCategorySwatch({
  color,
  className = "size-2.5",
}: {
  color: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block shrink-0 rounded-sm ${className}`}
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}