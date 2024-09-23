export const starts_with_prefix = (array: string[], variable: string): boolean => {
  return array.some((prefix) => variable.startsWith(prefix));
};
