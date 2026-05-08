import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import LoginScreen from '../../app/login';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
    },
  },
}));

describe('LoginScreen', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('allows the user to type an email and password', () => {
    const { getByPlaceholderText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    const emailInput = getByPlaceholderText(/email/i);
    const passwordInput = getByPlaceholderText(/password/i);

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');

    expect(emailInput.props.value).toBe('test@example.com');
    expect(passwordInput.props.value).toBe('password123');
  });

  test('calls Supabase signInWithPassword with the entered email and password', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    const { getByPlaceholderText, getByText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    fireEvent.changeText(getByPlaceholderText(/email/i), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText(/password/i), 'password123');
    fireEvent.press(getByText(/sign in/i));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  test('shows an error message when login fails', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: {
        message: 'Invalid login credentials',
      },
    });

    const { getByPlaceholderText, getByText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    fireEvent.changeText(getByPlaceholderText(/email/i), 'wrong@example.com');
    fireEvent.changeText(getByPlaceholderText(/password/i), 'wrongpassword');
    fireEvent.press(getByText(/sign in/i));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/invalid login credentials/i)
      );
    });
  });
});