type ProPillProps = {
  className?: string;
};

/** Soft red PRO badge used to mark premium features for free users. */
export function ProPill({ className }: ProPillProps) {
  return (
    <span
      className={["pro-pill", className].filter(Boolean).join(" ")}
      aria-hidden
    >
      Pro
    </span>
  );
}
