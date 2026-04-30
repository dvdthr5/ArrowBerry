import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import RegisterScreen from '../../app/signup';
import { supabase } from '../../lib/supabase';

const mockInsert = jest.fn();


jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
    },
    from: jest.fn(() => ({
      insert: mockInsert,
    })),
  },
}));

describe('RegisterScreen', () => {
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

  test('allows the user to type name, email, and password', () => {
    const { getByPlaceholderText } = render(
      <RegisterScreen navigation={mockNavigation} />
    );

    const nameInput = getByPlaceholderText(/name/i);
    const emailInput = getByPlaceholderText(/email/i);
    const passwordInput = getByPlaceholderText(/^password$/i);

    fireEvent.changeText(nameInput, 'Test User');
    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');

    expect(nameInput.props.value).toBe('Test User');
    expect(emailInput.props.value).toBe('test@example.com');
    expect(passwordInput.props.value).toBe('password123');
  });

  test('calls Supabase signUp with the entered email and password', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
        },
      },
      error: null,
    });

    mockInsert.mockResolvedValue({
      data: null,
      error: null,
    });

    const { getByPlaceholderText, getAllByText } = render(
      <RegisterScreen navigation={mockNavigation} />
    );

    fireEvent.changeText(getByPlaceholderText(/name/i), 'Test User');
    fireEvent.changeText(getByPlaceholderText(/email/i), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText(/^password$/i), 'password123');
    const createAccountButtons = getAllByText(/create account/i);
    fireEvent.press(createAccountButtons[1]);

    await waitFor(() => {
        expect(supabase.auth.signUp).toHaveBeenCalledWith({
            email: 'test@example.com',
            password: 'password123',
            options: {
                data: {
                    full_name: 'Test User',
                },
            },
        });
    });
});

  test('shows an error message when signup fails', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: null,
      error: {
        message: 'User already registered',
      },
    });

    const { getByPlaceholderText, getAllByText } = render(
      <RegisterScreen navigation={mockNavigation} />
    );

    fireEvent.changeText(getByPlaceholderText(/name/i), 'Test User');
    fireEvent.changeText(getByPlaceholderText(/email/i), 'existing@example.com');
    fireEvent.changeText(getByPlaceholderText(/^password$/i), 'password123');
    const createAccountButtons = getAllByText(/create account/i);
    fireEvent.press(createAccountButtons[1]);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/user already registered/i)
      );
    });
  });
});