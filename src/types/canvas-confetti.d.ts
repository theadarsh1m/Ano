declare module 'canvas-confetti' {
  export interface Options {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    ticks?: number;
    origin?: {
      x?: number;
      y?: number;
    };
    colors?: string[];
    shapes?: string[];
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }

  export interface GlobalOptions {
    resize?: boolean;
    useWorker?: boolean;
  }

  export type CreateTypes = (options?: GlobalOptions) => (options?: Options) => Promise<null> | null;

  function confetti(options?: Options): Promise<null> | null;

  namespace confetti {
    export const create: CreateTypes;
    export function reset(): void;
  }

  export default confetti;
}
