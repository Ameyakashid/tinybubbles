import type { ComponentProps } from 'react';
import { Star } from 'lucide-react';

import { cn } from '../lib/utils';

type FocusStarIconProps = Omit<ComponentProps<typeof Star>, 'fill'> & {
    filled?: boolean;
};

/**
 * A filled star paints its fill and its outline from two different tokens.
 *
 * One colour cannot do both jobs on a light background: a gold bright enough to
 * read as a star sits around 1.6:1 against white, and darkening it far enough to
 * carry contrast on its own turns it brown. Splitting them lets the outline hold
 * the shape's legibility (over 4:1 in every theme) while the fill stays gold.
 */
export function FocusStarIcon({ filled = false, className, ...props }: FocusStarIconProps) {
    return (
        <Star
            {...props}
            className={cn(className, filled && 'fill-focus-star text-focus-star-outline')}
            fill={filled ? 'currentColor' : 'none'}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    );
}
