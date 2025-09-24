export type AudioPreloadCommand =
  | AudioPreloadRequestCommand
  | AudioPreloadAbortCommand;

export interface AudioPreloadRequestCommand {
  type: "AUDIO_PRELOAD";
  id: string;
  urls: string[];
  /**
   * Optional fetch cache mode; defaults to browser behaviour.
   */
  cache?: RequestCache;
}

export interface AudioPreloadAbortCommand {
  type: "AUDIO_PRELOAD_ABORT";
  /**
   * Abort a specific preload request. When omitted, all active requests stop.
   */
  id?: string;
}

export type AudioPreloadEvent =
  | AudioPreloadProgressEvent
  | AudioPreloadCompleteEvent
  | AudioPreloadAbortedEvent;

export interface AudioPreloadProgressEvent {
  type: "AUDIO_PRELOAD_PROGRESS";
  id: string;
  url: string;
  status: "loaded" | "error";
  error?: string;
}

export interface AudioPreloadCompleteEvent {
  type: "AUDIO_PRELOAD_COMPLETE";
  id: string;
  loaded: string[];
  failed: AudioPreloadFailure[];
}

export interface AudioPreloadAbortedEvent {
  type: "AUDIO_PRELOAD_ABORTED";
  id: string;
}

export interface AudioPreloadFailure {
  readonly url: string;
  readonly error: string;
}

export function isAudioPreloadCommand(
  value: unknown,
): value is AudioPreloadCommand {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string"
  );
}
