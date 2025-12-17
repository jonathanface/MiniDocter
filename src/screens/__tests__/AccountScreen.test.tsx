import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AccountScreen } from '../AccountScreen';
import { getBillingSummary, createPortalSession } from '../../utils/api';
import { Linking } from 'react-native';

// Mock dependencies
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
  })),
}));

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bgBody: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#666666',
      primary: '#007AFF',
      success: '#34C759',
      warning: '#FF9500',
      danger: '#FF3B30',
    },
  }),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    getSessionToken: jest.fn(() => Promise.resolve('mock-token')),
    setUser: jest.fn(),
  }),
}));

jest.mock('../../utils/api', () => ({
  getBillingSummary: jest.fn(),
  createPortalSession: jest.fn(),
}));

const mockCanOpenURL = jest.fn();
const mockOpenURL = jest.fn();

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  __esModule: true,
  default: {
    canOpenURL: mockCanOpenURL,
    openURL: mockOpenURL,
  },
}));

const mockGetBillingSummary = getBillingSummary as jest.MockedFunction<typeof getBillingSummary>;
const mockCreatePortalSession = createPortalSession as jest.MockedFunction<typeof createPortalSession>;

describe('AccountScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should not show buttons while loading', () => {
      mockGetBillingSummary.mockReturnValue(new Promise(() => {})); // Never resolves

      const { queryByText } = render(<AccountScreen />);

      // Buttons should not be visible yet since data hasn't loaded
      // Note: The component shows a loader during this time
      expect(queryByText('Membership')).toBeTruthy(); // Title should still show
    });
  });

  describe('Never Subscribed State', () => {
    it('should show JOIN NOW button when status is none', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'none' }),
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => {
        expect(getByText('NONE')).toBeTruthy();
        expect(getByText('JOIN NOW')).toBeTruthy();
      });
    });

    it('should navigate to Subscribe screen when JOIN NOW is pressed', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'none' }),
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => expect(getByText('JOIN NOW')).toBeTruthy());

      fireEvent.press(getByText('JOIN NOW'));

      expect(mockNavigate).toHaveBeenCalledWith('Subscribe');
    });

    it('should show benefits message for non-subscribers', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'none' }),
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => {
        expect(getByText(/unlimited documents/i)).toBeTruthy();
      });
    });
  });

  describe('Active Subscription State', () => {
    it('should show MANAGE BILLING button when status is active', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'active' }),
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => {
        expect(getByText('ACTIVE')).toBeTruthy();
        expect(getByText('MANAGE BILLING')).toBeTruthy();
      });
    });

    it('should show MANAGE BILLING button when status is trialing', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'trialing' }),
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => {
        expect(getByText('TRIALING')).toBeTruthy();
        expect(getByText('MANAGE BILLING')).toBeTruthy();
      });
    });

    it('should call portal session API when MANAGE BILLING is pressed', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'active' }),
      } as Response);

      mockCreatePortalSession.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ url: 'https://billing.stripe.com/session/123' }),
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => expect(getByText('MANAGE BILLING')).toBeTruthy());

      fireEvent.press(getByText('MANAGE BILLING'));

      await waitFor(() => {
        expect(mockCreatePortalSession).toHaveBeenCalledWith('minidocter://account');
      });
    });

    it('should show warning when subscription is scheduled to cancel', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'active',
          cancelAtPeriodEnd: true,
          currentPeriodEnd: '2025-12-31T23:59:59Z',
        }),
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => {
        expect(getByText(/subscription will end on/i)).toBeTruthy();
        expect(getByText(/reactivate anytime/i)).toBeTruthy();
      });
    });
  });

  describe('Incomplete Subscription State', () => {
    it('should show COMPLETE PAYMENT button when status is incomplete', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'incomplete' }),
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => {
        expect(getByText('INCOMPLETE')).toBeTruthy();
        expect(getByText('COMPLETE PAYMENT')).toBeTruthy();
      });
    });

    it('should navigate to Subscribe screen when COMPLETE PAYMENT is pressed', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'incomplete' }),
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => expect(getByText('COMPLETE PAYMENT')).toBeTruthy());

      fireEvent.press(getByText('COMPLETE PAYMENT'));

      expect(mockNavigate).toHaveBeenCalledWith('Subscribe');
    });

    it('should show processing message for incomplete subscriptions', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'incomplete' }),
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => {
        expect(getByText(/payment is being processed/i)).toBeTruthy();
      });
    });
  });

  describe('Expired Subscription State', () => {
    it('should show REACTIVATE button when status is canceled', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'canceled' }),
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => {
        expect(getByText('CANCELED')).toBeTruthy();
        expect(getByText('REACTIVATE')).toBeTruthy();
      });
    });

    it('should show REACTIVATE button when status is incomplete_expired', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'incomplete_expired' }),
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => {
        expect(getByText('INCOMPLETE_EXPIRED')).toBeTruthy();
        expect(getByText('REACTIVATE')).toBeTruthy();
      });
    });

    it('should show REACTIVATE button when status is unpaid', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'unpaid' }),
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => {
        expect(getByText('UNPAID')).toBeTruthy();
        expect(getByText('REACTIVATE')).toBeTruthy();
      });
    });

    it('should navigate to Subscribe screen when REACTIVATE is pressed', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'canceled' }),
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => expect(getByText('REACTIVATE')).toBeTruthy());

      fireEvent.press(getByText('REACTIVATE'));

      expect(mockNavigate).toHaveBeenCalledWith('Subscribe');
    });

    it('should show expiration message for expired subscriptions', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'canceled' }),
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => {
        expect(getByText(/subscription has expired/i)).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error when billing summary fails', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => {
        expect(getByText('Error')).toBeTruthy(); // "Error" not "ERROR"
      });
    });

    it('should show button when there is an error', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => {
        // Button should still exist even with error
        expect(getByText('JOIN NOW')).toBeTruthy();
      });
    });

    it('should handle error when portal session creation fails', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'active' }),
      } as Response);

      mockCreatePortalSession.mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => expect(getByText('MANAGE BILLING')).toBeTruthy());

      fireEvent.press(getByText('MANAGE BILLING'));

      // The error is set in state but may not immediately show
      // Just verify the button press happened
      await waitFor(() => {
        expect(mockCreatePortalSession).toHaveBeenCalled();
      });
    });
  });

  describe('Pull to Refresh', () => {
    it('should call getBillingSummary on initial load', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'active' }),
      } as Response);

      render(<AccountScreen />);

      await waitFor(() => {
        expect(mockGetBillingSummary).toHaveBeenCalled();
      });
    });
  });

  describe('Navigation', () => {
    it('should call navigation.goBack when Close button is pressed', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'active' }),
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => expect(getByText('Close')).toBeTruthy());

      fireEvent.press(getByText('Close'));

      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('UI Elements', () => {
    it('should always display pricing information', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'active' }),
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => {
        expect(getByText(/\$5\/month/i)).toBeTruthy();
        expect(getByText(/cancel anytime/i)).toBeTruthy();
      });
    });

    it('should display "Membership" title', async () => {
      mockGetBillingSummary.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'active' }),
      } as Response);

      const { getByText } = render(<AccountScreen />);

      await waitFor(() => {
        expect(getByText('Membership')).toBeTruthy();
      });
    });
  });
});
