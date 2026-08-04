import { MOVE_SPEED, ROTATE_SPEED } from '../data/constants';

export class InputSystem {
  private enabled: boolean = false;
  private currentX: number = 400;
  private currentAngle: number = 0;

  // Callbacks
  private onMove: (x: number) => void;
  private onRotate: (angle: number) => void;
  private onDrop: () => void;

  // Event handlers bindings
  private handleKeyDownBound: (e: KeyboardEvent) => void;
  private handleMouseMoveBound: (e: MouseEvent) => void;
  private handleWheelBound: (e: WheelEvent) => void;
  private handleTouchMoveBound: (e: TouchEvent) => void;

  constructor(callbacks: {
    onMove: (x: number) => void;
    onRotate: (angle: number) => void;
    onDrop: () => void;
  }) {
    this.onMove = callbacks.onMove;
    this.onRotate = callbacks.onRotate;
    this.onDrop = callbacks.onDrop;

    this.handleKeyDownBound = this.handleKeyDown.bind(this);
    this.handleMouseMoveBound = this.handleMouseMove.bind(this);
    this.handleWheelBound = this.handleWheel.bind(this);
    this.handleTouchMoveBound = this.handleTouchMove.bind(this);
  }

  public enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.currentX = 400;
    this.currentAngle = 0;

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDownBound);
      window.addEventListener('mousemove', this.handleMouseMoveBound);
      window.addEventListener('wheel', this.handleWheelBound, { passive: false });
      window.addEventListener('touchmove', this.handleTouchMoveBound, { passive: false });
    }
  }

  public disable() {
    if (!this.enabled) return;
    this.enabled = false;

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDownBound);
      window.removeEventListener('mousemove', this.handleMouseMoveBound);
      window.removeEventListener('wheel', this.handleWheelBound);
      window.removeEventListener('touchmove', this.handleTouchMoveBound);
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (!this.enabled) return;

    if (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowLeft') {
      this.currentAngle -= ROTATE_SPEED;
      this.onRotate(this.currentAngle);
    } else if (e.key === 'e' || e.key === 'E' || e.key === 'ArrowRight') {
      this.currentAngle += ROTATE_SPEED;
      this.onRotate(this.currentAngle);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.onDrop();
    }
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.enabled) return;

    // Map screen cursor position to game coordinates
    // Assuming simple screen fit centered horizontally
    const width = window.innerWidth;
    const xRatio = e.clientX / width;
    const targetX = xRatio * 800; // Map to 800 game width
    
    this.currentX = Math.max(100, Math.min(700, targetX));
    this.onMove(this.currentX);
  }

  private handleWheel(e: WheelEvent) {
    if (!this.enabled) return;
    e.preventDefault();

    // Wheel rotation speed
    const factor = e.deltaY > 0 ? 1 : -1;
    this.currentAngle += factor * ROTATE_SPEED * 2;
    this.onRotate(this.currentAngle);
  }

  private handleTouchMove(e: TouchEvent) {
    if (!this.enabled || e.touches.length === 0) return;
    e.preventDefault();

    const touch = e.touches[0];
    const width = window.innerWidth;
    const xRatio = touch.clientX / width;
    const targetX = xRatio * 800;

    this.currentX = Math.max(100, Math.min(700, targetX));
    this.onMove(this.currentX);
  }

  /**
   * Helper to manually rotate from HUD UI buttons (for mobile).
   */
  public rotateManual(direction: 'left' | 'right') {
    if (!this.enabled) return;
    const factor = direction === 'left' ? -1 : 1;
    this.currentAngle += factor * 0.2; // bigger steps for buttons
    this.onRotate(this.currentAngle);
  }

  /**
   * Helper to manually move from HUD slider (for mobile).
   */
  public moveManual(x: number) {
    if (!this.enabled) return;
    this.currentX = Math.max(100, Math.min(700, x));
    this.onMove(this.currentX);
  }

  public isTouchDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }
}
