export const ExitCode = Object.freeze({
  success: 0,
  internal: 1,
  validation: 2,
  stale: 3,
  io: 4,
  interrupted: 130,
} as const);

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
