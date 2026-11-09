const cardVariants = {
  light: 'bg-white border border-black/[0.06] shadow-soft',
  surface: 'bg-surface border border-black/[0.04]',
  forest: 'bg-forest text-white',
  cream: 'bg-cream text-ink',
};

export default function Card({ children, variant = 'light', className = '', ...props }) {
  return (
    <div className={`rounded-[24px] p-6 ${cardVariants[variant] || cardVariants.light} ${className}`} {...props}>
      {children}
    </div>
  );
}
