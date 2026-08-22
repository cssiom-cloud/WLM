export function isCapacityLimited(item) {
  return item?.capacity_limited !== false;
}

export function isAnnouncementFull(item) {
  return isCapacityLimited(item) && Number(item?.signed_count || 0) >= Number(item?.max_capacity || 1);
}

export function capacityFillRatio(item) {
  const count = Number(item?.signed_count || 0);
  if (!isCapacityLimited(item)) {
    return Math.min(0.62, 0.16 + count * 0.05);
  }
  return Math.min(1, count / Math.max(1, Number(item?.max_capacity || 1)));
}

export function decorateAnnouncement(announcement, signups = [], peopleById = new Map(), currentUserId = '') {
  const related = signups.filter((row) => row.announcement_id === announcement.id);
  return {
    ...announcement,
    show_participants: announcement.show_participants !== false,
    capacity_limited: announcement.capacity_limited !== false,
    signed_count: related.length,
    is_signed: Boolean(currentUserId && related.some((row) => row.user_id === currentUserId)),
    participants: related.map((row) => peopleById.get(row.user_id)).filter(Boolean)
  };
}
