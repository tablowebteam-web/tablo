// =============================================================
// TABLO — Discount calculation engine
// Pure functions. Used by both server (API) and client (banner).
// =============================================================

export interface OfferConfig {
  offer_type: 'birthday' | 'anniversary' | 'first_visit' | 'regular_customer';
  enabled: boolean;
  discount_kind: 'percent' | 'amount';
  discount_value: number;
  description: string | null;
}

export interface CustomerContext {
  birthday: string | null;       // YYYY-MM-DD
  anniversary: string | null;    // YYYY-MM-DD
  visitCount: number;            // visits to THIS restaurant
}

export interface AppliedOffer {
  offerType: 'birthday' | 'anniversary' | 'first_visit' | 'regular_customer';
  description: string;
  discountAmount: number;        // ₹ amount taken off the subtotal
}

/**
 * Check if a date string (YYYY-MM-DD) matches today's month/day.
 * Year is ignored — we only care if today is your birthday/anniversary.
 */
function isMonthDayToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date();
  const [, mo, day] = dateStr.split('-').map(Number);
  return today.getMonth() + 1 === mo && today.getDate() === day;
}

/**
 * Calculate the best applicable offer for this customer at this restaurant.
 *
 * Logic: only ONE offer applies per order (the best/biggest discount wins).
 * Priority order: birthday/anniversary > first visit > regular.
 * (We pick the largest discount amount among eligible offers.)
 */
export function calculateBestOffer(
  subtotal: number,
  customer: CustomerContext,
  offers: OfferConfig[]
): AppliedOffer | null {
  if (subtotal <= 0) return null;

  const enabled = offers.filter(o => o.enabled);
  if (enabled.length === 0) return null;

  const candidates: AppliedOffer[] = [];

  for (const offer of enabled) {
    let eligible = false;
    let label = '';

    switch (offer.offer_type) {
      case 'birthday':
        if (isMonthDayToday(customer.birthday)) {
          eligible = true;
          label = '🎂 Happy birthday';
        }
        break;
      case 'anniversary':
        if (isMonthDayToday(customer.anniversary)) {
          eligible = true;
          label = '💍 Happy anniversary';
        }
        break;
      case 'first_visit':
        if (customer.visitCount === 0) {
          eligible = true;
          label = '👋 Welcome to our restaurant';
        }
        break;
      case 'regular_customer':
        // 3+ previous visits = regular (4th visit triggers it)
        if (customer.visitCount >= 3) {
          eligible = true;
          label = '🏆 Thanks for being a regular';
        }
        break;
    }

    if (!eligible) continue;

    // Calculate discount amount
    let discountAmount = 0;
    if (offer.discount_kind === 'percent') {
      discountAmount = Math.round((subtotal * offer.discount_value) / 100);
    } else {
      discountAmount = Math.min(Math.round(offer.discount_value), subtotal);
    }
    if (discountAmount <= 0) continue;

    const offerLabel = offer.discount_kind === 'percent'
      ? `${offer.discount_value}% off`
      : `₹${Math.round(offer.discount_value)} off`;

    candidates.push({
      offerType: offer.offer_type,
      description: offer.description?.trim()
        ? `${label}: ${offer.description}`
        : `${label} — ${offerLabel}!`,
      discountAmount
    });
  }

  if (candidates.length === 0) return null;

  // Pick the biggest discount
  candidates.sort((a, b) => b.discountAmount - a.discountAmount);
  return candidates[0];
}

/**
 * Format a numeric date string (YYYY-MM-DD) as a friendly preview
 * e.g., "Apr 15"
 */
export function formatMonthDay(dateStr: string | null): string {
  if (!dateStr) return '';
  const [, mo, day] = dateStr.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[mo - 1]} ${day}`;
}
