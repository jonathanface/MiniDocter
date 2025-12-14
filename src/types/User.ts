export interface UserDetails {
  email: string;
  first_name?: string;
  last_name?: string;
  subscriber: boolean;
  admin?: boolean;
}

export interface User {
  isLoggedIn: boolean;
  userDetails: UserDetails;
}

export interface SubscriptionSummary {
  id?: string;
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}
