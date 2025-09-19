export type AppScreenKey = "home" | "practice" | "workout";

export interface ScreenProps {
  onNavigate: (next: AppScreenKey) => void;
}
