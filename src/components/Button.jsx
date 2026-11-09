import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const MotionLink = motion.create(Link);

const variants = {
  primary: 'bg-lime text-ink font-semibold hover:bg-limehover',
  forest: 'bg-forest text-white font-semibold hover:bg-forestdeep',
  secondary: 'border border-black/15 bg-white text-ink hover:bg-black/[0.04]',
  danger: 'bg-danger text-white font-semibold hover:bg-red-800',
  ghost: 'text-muted hover:text-ink',
  ghostDark: 'text-white/75 hover:text-white',
};

const sizes = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-7 py-3.5 text-base sm:text-lg',
};

function ArrowUpRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M5 13L13 5M13 5H6.5M13 5V11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Pass `to` for navigation: it renders a real link instead of a button in a link.
 * `arrow` adds the white circle with an arrow that sits against the pill.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  arrow = false,
  className = '',
  to,
  disabled,
  ...props
}) {
  const Component = to ? MotionLink : motion.button;
  const interactive = !disabled;
  const motionProps = {
    whileHover: interactive ? { scale: 1.02 } : undefined,
    whileTap: interactive ? { scale: 0.98 } : undefined,
  };

  if (arrow) {
    return (
      <Component
        to={to}
        disabled={to ? undefined : disabled}
        {...motionProps}
        className={`group inline-flex items-center rounded-full ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
        {...props}
      >
        <span className={`inline-flex items-center rounded-full font-medium transition-colors ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} pr-9`}>
          {children}
        </span>
        <span className="-ml-6 h-12 w-12 sm:h-[52px] sm:w-[52px] rounded-full bg-white text-ink flex items-center justify-center shadow-soft transition-transform group-hover:rotate-45">
          <ArrowUpRight />
        </span>
      </Component>
    );
  }

  return (
    <Component
      to={to}
      disabled={to ? undefined : disabled}
      {...motionProps}
      className={`
        inline-flex items-center justify-center gap-2 rounded-full font-medium
        transition-colors duration-200
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${className}
      `}
      {...props}
    >
      {children}
      {icon && <span className="flex items-center">{icon}</span>}
    </Component>
  );
}
