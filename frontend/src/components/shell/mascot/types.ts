/** All the states the sidebar mascot can be in. `hidden` is the resting state
    when no interaction is happening; every other value is a live interaction
    that shows the dino. */
export type MascotState = "hidden" | "searching" | "indexing" | "nothing";

/** The visible (non-resting) mascot states, i.e. the states that map to an
    asset and get their own pop-in. */
export type ActiveMascotState = Exclude<MascotState, "hidden">;
