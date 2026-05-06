// =============================================================
// TABLO — Role-based permissions
// =============================================================

export type Role = 'owner' | 'manager' | 'staff';

export interface Permission {
  view_orders: boolean;
  manage_orders: boolean;        // mark ready/served
  walk_in_counter: boolean;
  view_kitchen: boolean;
  view_reservations: boolean;
  manage_reservations: boolean;
  edit_menu: boolean;
  manage_offers: boolean;
  verify_payments: boolean;
  view_insights: boolean;
  edit_settings: boolean;        // restaurant settings, UPI
  manage_team: boolean;
}

export function permissionsFor(role: Role): Permission {
  if (role === 'owner') {
    return {
      view_orders: true,
      manage_orders: true,
      walk_in_counter: true,
      view_kitchen: true,
      view_reservations: true,
      manage_reservations: true,
      edit_menu: true,
      manage_offers: true,
      verify_payments: true,
      view_insights: true,
      edit_settings: true,
      manage_team: true
    };
  }
  if (role === 'manager') {
    return {
      view_orders: true,
      manage_orders: true,
      walk_in_counter: true,
      view_kitchen: true,
      view_reservations: true,
      manage_reservations: true,
      edit_menu: true,
      manage_offers: true,
      verify_payments: true,
      view_insights: true,
      edit_settings: false,
      manage_team: false
    };
  }
  // staff
  return {
    view_orders: true,
    manage_orders: true,
    walk_in_counter: true,
    view_kitchen: true,
    view_reservations: true,
    manage_reservations: true,
    edit_menu: false,
    manage_offers: false,
    verify_payments: false,
    view_insights: false,
    edit_settings: false,
    manage_team: false
  };
}

export function hasPermission(role: Role | null | undefined, permission: keyof Permission): boolean {
  if (!role) return false;
  const perms = permissionsFor(role);
  return perms[permission];
}

export function roleLabel(role: Role): string {
  return { owner: 'Owner', manager: 'Manager', staff: 'Staff' }[role];
}
