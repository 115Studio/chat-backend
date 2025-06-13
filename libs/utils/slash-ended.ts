export const slashEnded = (input: string): string => {
  if (input.endsWith('/')) {
    return input
  }

  return `${input}/`
}
