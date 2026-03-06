interface Window {
  gtag?: (...args: any[]) => void;
  fbq?: (...args: any[]) => void;
  dataLayer?: Array<Record<string, unknown>>;
}
