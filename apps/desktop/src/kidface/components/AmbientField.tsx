/**
 * Ambient motion for empty states.
 *
 * Graduated from the motion playground: slow drifting bubbles that keep a
 * quiet room from feeling abandoned, without demanding a tap.
 */
export function AmbientField() {
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="kidface-drift absolute -left-4 top-[15%] size-16 rounded-full bg-primary/15 blur-xl" />
            <div className="kidface-drift-slow absolute bottom-[20%] right-[5%] size-20 rounded-full bg-success/15 blur-xl" />
            <div className="kidface-drift-medium absolute left-[35%] top-[8%] size-14 rounded-full bg-info/15 blur-xl" />
        </div>
    );
}
