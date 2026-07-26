export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
        colorScheme?: "light" | "dark";
        ready?: () => void;
        expand?: () => void;
        openInvoice?: (
          url: string,
          callback?: (status: string) => void,
        ) => void;
        HapticFeedback?: {
          impactOccurred?: (style: "light" | "medium" | "heavy") => void;
          notificationOccurred?: (
            type: "error" | "success" | "warning",
          ) => void;
        };
      };
    };
  }
}
