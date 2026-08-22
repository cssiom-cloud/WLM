import { motion } from 'framer-motion';

export default function FloatTilt({ children, className = '', as = 'div' }) {
  const Tag = motion[as] || motion.div;
  return (
    <Tag
      className={className}
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 380, damping: 24 }}
    >
      {children}
    </Tag>
  );
}
