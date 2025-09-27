export interface PoseCameraStartOptions {
  readonly constraints?: MediaStreamConstraints;
}

export type PoseCameraFrame = { kind: 'bitmap'; bitmap: ImageBitmap } | { kind: 'imageData'; imageData: ImageData };

export interface PoseCamera {
  start(video: HTMLVideoElement, options?: PoseCameraStartOptions): Promise<void>;
  stop(): void;
  captureFrame(): Promise<PoseCameraFrame | null>;
}

const DEFAULT_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: 'user',
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 30, max: 30 },
  },
};

export class PoseCameraService implements PoseCamera {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;

  async start(video: HTMLVideoElement, options: PoseCameraStartOptions = {}): Promise<void> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera access is not supported in this browser');
    }

    if (this.stream) {
      // Already started; just rebind the existing stream to the new element if needed.
      this.bindVideo(video, this.stream);
      this.video = video;
      return;
    }

    const constraints = options.constraints ?? DEFAULT_CONSTRAINTS;
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    this.bindVideo(video, stream);
    this.stream = stream;
    this.video = video;
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;

    if (this.video) {
      this.video.srcObject = null;
      try {
        this.video.pause();
      } catch {
        // Ignore pause errors (video may already be stopped).
      }
    }

    this.video = null;
    this.resetCanvas();
  }

  isActive(): boolean {
    return this.stream != null;
  }

  async captureFrame(): Promise<PoseCameraFrame | null> {
    const video = this.video;
    if (!video || !this.stream) {
      return null;
    }

    if (!isVideoReady(video)) {
      return null;
    }

    try {
      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(video);
        return { kind: 'bitmap', bitmap };
      }
    } catch {
      // Fallback to canvas capture below.
    }

    const canvas = this.ensureCanvas();
    const context = this.ensureContext(canvas);
    if (!context) {
      return null;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      return { kind: 'imageData', imageData };
    } catch {
      return null;
    }
  }

  private bindVideo(video: HTMLVideoElement, stream: MediaStream) {
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;

    // Safari requires a play() call after setting srcObject; ignore rejection (e.g., not interacted yet).
    void video.play().catch(() => undefined);
  }

  private ensureCanvas(): HTMLCanvasElement {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
    }
    return this.canvas;
  }

  private ensureContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
    if (!this.context) {
      this.context = canvas.getContext('2d', { willReadFrequently: true });
    }
    return this.context;
  }

  private resetCanvas() {
    this.canvas = null;
    this.context = null;
  }
}

function isVideoReady(video: HTMLVideoElement) {
  return video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0;
}
