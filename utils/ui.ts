import { Dimensions } from 'react-native';

/**
 * Calculate the position for a dropdown menu relative to its anchor element.
 * Ensures the menu stays within screen boundaries with appropriate padding.
 *
 * @param anchor - The anchor element's position and dimensions
 * @param insetTop - The safe area inset from the top of the screen
 * @param menuWidth - The width of the menu (default: 180)
 * @returns The calculated top and left position for the menu
 */
export const getMenuPosition = (
  anchor: { x: number; y: number; width: number; height: number },
  insetTop: number,
  menuWidth: number = 180,
) => {
  const screenWidth = Dimensions.get('window').width;
  const HORIZONTAL_PADDING = 16;
  const VERTICAL_SPACING = 8;

  // Calculate horizontal position:
  // - Try to align menu right edge with anchor right edge
  // - But ensure menu doesn't overflow screen on either side
  const left = Math.min(
    Math.max(HORIZONTAL_PADDING, anchor.x + anchor.width - menuWidth),
    screenWidth - menuWidth - HORIZONTAL_PADDING,
  );

  // Calculate vertical position:
  // - Position below anchor with spacing
  // - Ensure menu is below safe area top inset
  const top = Math.max(anchor.y + anchor.height + VERTICAL_SPACING, insetTop + VERTICAL_SPACING);

  return { top, left };
};
