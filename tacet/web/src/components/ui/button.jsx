import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-zinc-200 hover:scale-[1.02] shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/75 border border-white/5 hover:border-white/10 shadow-sm',
        outline: 'border border-white/10 bg-black/20 backdrop-blur-sm hover:bg-white/10 hover:text-foreground shadow-sm hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]',
        ghost: 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground',
        destructive: 'bg-red-500/90 text-white hover:bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]',
        link: 'text-sky-400 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-6',
        icon: 'h-9 w-9',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({ className, variant, size, ...props }) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { Button, buttonVariants };
