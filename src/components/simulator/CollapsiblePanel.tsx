import { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CollapsiblePanelProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  headerAction?: ReactNode;
  onToggle?: (isOpen: boolean) => void;
}

export function CollapsiblePanel({
  title,
  icon,
  children,
  defaultOpen = true,
  className,
  headerClassName,
  headerAction,
  onToggle,
}: CollapsiblePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  };

  return (
    <div className={cn('glass-card rounded-xl overflow-hidden', className)}>
      <div className={cn(
        'flex items-center justify-between p-4',
        headerClassName
      )}>
        <Button
          variant="ghost"
          onClick={handleToggle}
          className="flex items-center gap-3 p-0 h-auto hover:bg-transparent"
        >
          {icon && (
            <div className="p-2 rounded-lg bg-primary/20">
              {icon}
            </div>
          )}
          <span className="font-bold text-base">{title}</span>
          {isOpen ? (
            <ChevronUp size={18} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={18} className="text-muted-foreground" />
          )}
        </Button>
        
        {headerAction && (
          <div onClick={(e) => e.stopPropagation()}>
            {headerAction}
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
