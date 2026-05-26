export const logger = {
  info(message: string, meta?: unknown) {
    if (meta === undefined) {
      console.log(`[info] ${message}`);
      return;
    }
    console.log(`[info] ${message}`, meta);
  },
  error(message: string, meta?: unknown) {
    if (meta === undefined) {
      console.error(`[error] ${message}`);
      return;
    }
    console.error(`[error] ${message}`, meta);
  }
};
