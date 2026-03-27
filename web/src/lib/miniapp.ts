export const isMiniApp =
  typeof window !== "undefined" && window.parent !== window;
