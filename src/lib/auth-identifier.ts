const USERNAME_AUTH_DOMAIN = (import.meta.env.VITE_AUTH_USERNAME_DOMAIN ?? "users.local")
  .trim()
  .toLowerCase();

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export function toAuthEmail(identifier: string): string {
  const value = identifier.trim().toLowerCase();
  if (!value) return "";
  if (value.includes("@")) return value;
  return `${value}@${USERNAME_AUTH_DOMAIN}`;
}

export function isUsernameIdentifier(identifier: string): boolean {
  const value = identifier.trim();
  return value.length > 0 && !value.includes("@");
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username.trim());
}
