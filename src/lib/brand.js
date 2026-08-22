function publicAsset(path) {
  const file = String(path || '').replace(/^\//, '');
  try {
    const base = String(import.meta.env?.BASE_URL || '/');
    return `${base}${file}`;
  } catch {
    return `/${file}`;
  }
}

export const SITE_LOGO = publicAsset('assets/1.jpg');
