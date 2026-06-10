// lib/admin-config.js
export const INTERNAL_EMAILS = new Set([
  'caesar@newfound.agency',
  'mailtocaesar@gmail.com',
  'mail@caesarconcepts.nl',
]);

export async function getInternalUserIds(serviceClient) {
  try {
    const result = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
    const users = result?.data?.users ?? [];
    return new Set(
      users.filter((u) => INTERNAL_EMAILS.has(u.email)).map((u) => u.id)
    );
  } catch {
    return new Set();
  }
}
