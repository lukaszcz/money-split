import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import BottomActionBar from '../../components/BottomActionBar';

describe('BottomActionBar', () => {
  it('renders correctly with label', () => {
    const { getByText } = render(
      <BottomActionBar label="Add Item" onPress={jest.fn()} />,
    );

    expect(getByText('Add Item')).toBeTruthy();
  });

  it('applies correct accessibility label', () => {
    const { getByLabelText } = render(
      <BottomActionBar label="Add Group" onPress={jest.fn()} />,
    );

    expect(getByLabelText('Add Group')).toBeTruthy();
  });

  it('calls onPress handler when pressed', () => {
    const mockOnPress = jest.fn();
    const { getByLabelText } = render(
      <BottomActionBar label="Add Expense" onPress={mockOnPress} />,
    );

    fireEvent.press(getByLabelText('Add Expense'));

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });
});
