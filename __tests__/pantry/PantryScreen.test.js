import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { NavigationContainer } from '@react-navigation/native';
import PantryScreen from '../../app/screens/PantryScreen';
import { supabase } from '../../lib/supabase';

const mockOrder = jest.fn();
const mockInsert = jest.fn();
const mockEq = jest.fn();
const mockDelete = jest.fn(() => ({
  eq: mockEq,
}));

const mockShoppingOrder = jest.fn();
const mockShoppingEqResult = jest.fn();
const mockShoppingEq = jest.fn(() => ({
  order: mockShoppingOrder,
  then: (resolve, reject) => mockShoppingEqResult().then(resolve, reject),
  catch: (reject) => mockShoppingEqResult().catch(reject),
}));
const mockShoppingSelect = jest.fn(() => ({
  eq: mockShoppingEq,
}));
const mockShoppingInsert = jest.fn();
const mockShoppingUpdateEq = jest.fn();
const mockShoppingUpdate = jest.fn(() => ({
  eq: mockShoppingUpdateEq,
}));
const mockShoppingDeleteEq = jest.fn();
const mockShoppingDelete = jest.fn(() => ({
  eq: mockShoppingDeleteEq,
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn((table) => {
      if (table === 'shopping_list') {
        return {
          select: mockShoppingSelect,
          insert: mockShoppingInsert,
          update: mockShoppingUpdate,
          delete: mockShoppingDelete,
        };
      }

      return {
        select: jest.fn(() => ({
          order: mockOrder,
        })),
        insert: mockInsert,
        delete: mockDelete,
      };
    }),
  },
}));

jest.mock('react-native-gesture-handler/Swipeable', () => {
  const React = require('react');

  return function MockSwipeable({ children, renderRightActions }) {
    return React.createElement(
      React.Fragment,
      null,
      children,
      renderRightActions ? renderRightActions() : null
    );
  };
});

describe('PantryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
        },
      },
      error: null,
    });

    mockOrder.mockResolvedValue({
      data: [],
      error: null,
    });

    mockInsert.mockResolvedValue({
      data: null,
      error: null,
    });

    mockEq.mockResolvedValue({
      data: null,
      error: null,
    });

    mockShoppingOrder.mockResolvedValue({
      data: [],
      error: null,
    });

    mockShoppingEqResult.mockResolvedValue({
      data: [],
      error: null,
    });

    mockShoppingInsert.mockResolvedValue({
      data: null,
      error: null,
    });

    mockShoppingUpdateEq.mockResolvedValue({
      data: null,
      error: null,
    });

    mockShoppingDeleteEq.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('fetches and displays pantry items', async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: 1,
          item_name: 'Apples',
          quantity: 4,
          measuringUnit: 'pcs',
          category: 'Produce',
          expiration_date: null,
          image_url: null,
        },
      ],
      error: null,
    });

    const { findByText } = render(
      <NavigationContainer>
        <PantryScreen />
      </NavigationContainer>
    );

    expect(await findByText('Apples')).toBeTruthy();
    expect(await findByText('Produce')).toBeTruthy();
    expect(await findByText('4')).toBeTruthy();
    expect(await findByText('pcs')).toBeTruthy();
  });

  test('shows empty pantry message when there are no items', async () => {
    mockOrder.mockResolvedValue({
      data: [],
      error: null,
    });

    const { findByText } = render(
      <NavigationContainer>
        <PantryScreen />
      </NavigationContainer>
    );

    expect(await findByText(/your pantry is empty/i)).toBeTruthy();
    expect(await findByText(/tap \+ to add your first item/i)).toBeTruthy();
  });

  test('shows an alert when trying to save an item without a name', async () => {
    mockOrder.mockResolvedValue({
      data: [],
      error: null,
    });

    const { findByText, getByText } = render(
      <NavigationContainer>
        <PantryScreen />
      </NavigationContainer>
    );

    expect(await findByText(/your pantry is empty/i)).toBeTruthy();

    fireEvent.press(getByText('+'));
    fireEvent.press(getByText(/save/i));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Missing Info',
        'Please enter an item name.'
      );
    });

    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('inserts a new pantry item with normalized values', async () => {
    mockOrder.mockResolvedValue({
      data: [],
      error: null,
    });

    mockInsert.mockResolvedValue({
      data: null,
      error: null,
    });

    const { findByText, getByText, getByPlaceholderText } = render(
      <NavigationContainer>
        <PantryScreen />
      </NavigationContainer>
    );

    expect(await findByText(/your pantry is empty/i)).toBeTruthy();

    fireEvent.press(getByText('+'));

    fireEvent.changeText(getByPlaceholderText(/e\.g\. chicken breast/i), '  Chicken Breast  ');
    fireEvent.changeText(getByPlaceholderText(/e\.g\. 2/i), ' 2 ');
    fireEvent.changeText(getByPlaceholderText(/e\.g\. kg/i), ' KG ');
    fireEvent.changeText(getByPlaceholderText(/yyyy-mm-dd/i), '2026-05-01');
    fireEvent.press(getByText('Meat'));
    fireEvent.press(getByText(/save/i));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        item_name: 'Chicken Breast',
        quantity: 2,
        measuringUnit: 'kg',
        category: 'Meat',
        expiration_date: '2026-05-01',
      });
    });
  });

  test('shows an alert when adding a pantry item fails', async () => {
    mockOrder.mockResolvedValue({
      data: [],
      error: null,
    });

    mockInsert.mockResolvedValue({
      data: null,
      error: {
        message: 'Insert failed',
      },
    });

    const { findByText, getByText, getByPlaceholderText } = render(
      <NavigationContainer>
        <PantryScreen />
      </NavigationContainer>
    );

    expect(await findByText(/your pantry is empty/i)).toBeTruthy();

    fireEvent.press(getByText('+'));
    fireEvent.changeText(getByPlaceholderText(/e\.g\. chicken breast/i), 'Milk');
    fireEvent.press(getByText(/save/i));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Insert failed');
    });
  });

  test('deletes a pantry item when delete is pressed', async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: 1,
          item_name: 'Apples',
          quantity: 4,
          measuringUnit: 'pcs',
          category: 'Produce',
          expiration_date: null,
          image_url: null,
        },
      ],
      error: null,
    });

    mockEq.mockResolvedValue({
      data: null,
      error: null,
    });

    const { findByText, getByText, queryByText } = render(
      <NavigationContainer>
        <PantryScreen />
      </NavigationContainer>
    );

    expect(await findByText('Apples')).toBeTruthy();

    fireEvent.press(getByText(/delete/i));

    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith('id', 1);
      expect(queryByText('Apples')).toBeNull();
    });
  });

  test('shows an alert when deleting a pantry item fails', async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: 1,
          item_name: 'Apples',
          quantity: 4,
          measuringUnit: 'pcs',
          category: 'Produce',
          expiration_date: null,
          image_url: null,
        },
      ],
      error: null,
    });

    mockEq.mockResolvedValue({
      data: null,
      error: {
        message: 'Delete failed',
      },
    });

    const { findByText, getByText } = render(
      <NavigationContainer>
        <PantryScreen />
      </NavigationContainer>
    );

    expect(await findByText('Apples')).toBeTruthy();

    fireEvent.press(getByText(/delete/i));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Delete failed');
    });
  });
// Shopping list tests

  test('adds a shopping list item with quantity and unit', async () => {
    mockOrder.mockResolvedValue({
      data: [],
      error: null,
    });

    mockShoppingEqResult.mockResolvedValue({
      data: [],
      error: null,
    });

    const { findByText, getByText, getByTestId, findByPlaceholderText, getByPlaceholderText } = render(<PantryScreen />);

    expect(await findByText(/your pantry is empty/i)).toBeTruthy();

    fireEvent.press(getByText('List'));

    const itemInput = await findByPlaceholderText('Item');
    const quantityInput = getByPlaceholderText('Qty');
    const unitInput = getByPlaceholderText('Unit');

    fireEvent.changeText(itemInput, '  Rice  ');
    fireEvent.changeText(quantityInput, '2');
    fireEvent.changeText(unitInput, ' cups ');
    fireEvent.press(getByTestId('shopping-add-button'));

    await waitFor(() => {
      expect(mockShoppingInsert).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        item_name: 'Rice',
        quantity: 2,
        unit: 'cups',
        checked: false,
      });
    });
  });

  test('combines duplicate shopping list items by adding quantities', async () => {
    mockOrder.mockResolvedValue({
      data: [],
      error: null,
    });

    mockShoppingOrder.mockResolvedValue({
      data: [],
      error: null,
    });

    mockShoppingEqResult.mockResolvedValue({
      data: [
        {
          id: 10,
          user_id: 'test-user-id',
          item_name: 'Rice',
          quantity: 2,
          unit: 'cups',
          checked: false,
        },
      ],
      error: null,
    });

    const { findByText, getByText, getByTestId, findByPlaceholderText, getByPlaceholderText } = render(<PantryScreen />);

    expect(await findByText(/your pantry is empty/i)).toBeTruthy();

    fireEvent.press(getByText('List'));

    const itemInput = await findByPlaceholderText('Item');
    const quantityInput = getByPlaceholderText('Qty');
    const unitInput = getByPlaceholderText('Unit');

    fireEvent.changeText(itemInput, ' rice ');
    fireEvent.changeText(quantityInput, '3');
    fireEvent.changeText(unitInput, 'cups');

    await waitFor(() => {
      expect(itemInput.props.value).toBe(' rice ');
      expect(quantityInput.props.value).toBe('3');
      expect(unitInput.props.value).toBe('cups');
    });

    fireEvent.press(getByTestId('shopping-add-button'));

    await waitFor(() => {
      expect(mockShoppingUpdate).toHaveBeenCalledWith({
        quantity: 5,
        unit: 'cups',
      });
      expect(mockShoppingUpdateEq).toHaveBeenCalledWith('id', 10);
      expect(mockShoppingInsert).not.toHaveBeenCalled();
    });
  });

  test('toggles a shopping list item checked state', async () => {
    mockOrder.mockResolvedValue({
      data: [],
      error: null,
    });

    mockShoppingOrder.mockResolvedValue({
      data: [
        {
          id: 20,
          user_id: 'test-user-id',
          item_name: 'Rice',
          quantity: 2,
          unit: 'cups',
          checked: false,
        },
      ],
      error: null,
    });

    const { findByText, getByText, getByTestId } = render(<PantryScreen />);

    expect(await findByText(/your pantry is empty/i)).toBeTruthy();

    fireEvent.press(getByText('List'));

    expect(await findByText('Rice')).toBeTruthy();
    expect(await findByText('2 cups')).toBeTruthy();

    fireEvent.press(getByTestId('shopping-checkbox-20'));

    await waitFor(() => {
      expect(mockShoppingUpdate).toHaveBeenCalledWith({ checked: true });
      expect(mockShoppingUpdateEq).toHaveBeenCalledWith('id', 20);
    });
  });

  test('deletes a shopping list item', async () => {
    mockOrder.mockResolvedValue({
      data: [],
      error: null,
    });

    mockShoppingOrder.mockResolvedValue({
      data: [
        {
          id: 30,
          user_id: 'test-user-id',
          item_name: 'Rice',
          quantity: 2,
          unit: 'cups',
          checked: false,
        },
      ],
      error: null,
    });

    const { findByText, getByText } = render(<PantryScreen />);

    expect(await findByText(/your pantry is empty/i)).toBeTruthy();

    fireEvent.press(getByText('List'));

    expect(await findByText('Rice')).toBeTruthy();

    fireEvent.press(getByText(/delete/i));

    await waitFor(() => {
      expect(mockShoppingDeleteEq).toHaveBeenCalledWith('id', 30);
    });
  });
});