import { Dimensions } from 'react-native';
import { getMenuPosition } from '../../utils/ui';

// Mock Dimensions
jest.mock('react-native', () => ({
  Dimensions: {
    get: jest.fn(),
  },
}));

const mockDimensions = Dimensions as jest.Mocked<typeof Dimensions>;

describe('getMenuPosition', () => {
  const DEFAULT_MENU_WIDTH = 180;
  const SCREEN_WIDTH = 375; // iPhone SE width
  const HORIZONTAL_PADDING = 16;
  const VERTICAL_SPACING = 8;

  beforeEach(() => {
    mockDimensions.get.mockReturnValue({
      width: SCREEN_WIDTH,
      height: 667,
      scale: 2,
      fontScale: 1,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('basic positioning', () => {
    it('should position menu below anchor with correct spacing', () => {
      const anchor = { x: 100, y: 50, width: 40, height: 40 };
      const insetTop = 44; // Status bar height

      const position = getMenuPosition(anchor, insetTop);

      // Should be positioned 8px below the anchor
      expect(position.top).toBe(anchor.y + anchor.height + VERTICAL_SPACING);
    });

    it('should align menu right edge with anchor right edge by default', () => {
      const anchor = { x: 200, y: 50, width: 40, height: 40 };
      const insetTop = 44;

      const position = getMenuPosition(anchor, insetTop);

      // Menu should align right edge with anchor right edge
      // left = anchor.x + anchor.width - menuWidth = 200 + 40 - 180 = 60
      expect(position.left).toBe(60);
    });

    it('should use custom menu width when provided', () => {
      const anchor = { x: 200, y: 50, width: 40, height: 40 };
      const insetTop = 44;
      const customMenuWidth = 250;

      const position = getMenuPosition(anchor, insetTop, customMenuWidth);

      // left = anchor.x + anchor.width - customMenuWidth = 200 + 40 - 250 = -10
      // But it should be clamped to HORIZONTAL_PADDING = 16
      expect(position.left).toBe(HORIZONTAL_PADDING);
    });
  });

  describe('horizontal overflow prevention', () => {
    it('should prevent menu from overflowing right edge of screen', () => {
      // Anchor positioned near right edge
      const anchor = { x: 350, y: 50, width: 40, height: 40 };
      const insetTop = 44;

      const position = getMenuPosition(anchor, insetTop);

      // Menu should be positioned such that it doesn't overflow
      // Maximum left = screenWidth - menuWidth - padding = 375 - 180 - 16 = 179
      expect(position.left).toBe(179);
      expect(position.left + DEFAULT_MENU_WIDTH).toBeLessThanOrEqual(
        SCREEN_WIDTH - HORIZONTAL_PADDING
      );
    });

    it('should prevent menu from overflowing left edge of screen', () => {
      // Anchor positioned near left edge
      const anchor = { x: 0, y: 50, width: 40, height: 40 };
      const insetTop = 44;

      const position = getMenuPosition(anchor, insetTop);

      // Menu should be positioned at minimum padding from left edge
      expect(position.left).toBe(HORIZONTAL_PADDING);
      expect(position.left).toBeGreaterThanOrEqual(HORIZONTAL_PADDING);
    });

    it('should handle anchor in middle of screen correctly', () => {
      // Anchor in center of screen
      const anchor = { x: 150, y: 50, width: 40, height: 40 };
      const insetTop = 44;

      const position = getMenuPosition(anchor, insetTop);

      // Should align with anchor right edge without overflow
      // left = 150 + 40 - 180 = 10, clamped to 16
      expect(position.left).toBe(HORIZONTAL_PADDING);
    });
  });

  describe('vertical overflow prevention with safe area insets', () => {
    it('should respect safe area top inset when anchor is too high', () => {
      // Anchor very close to top
      const anchor = { x: 100, y: 10, width: 40, height: 40 };
      const insetTop = 44; // Large status bar

      const position = getMenuPosition(anchor, insetTop);

      // Menu should be below insetTop
      // top = max(10 + 40 + 8, 44 + 8) = max(58, 52) = 58
      expect(position.top).toBe(58);
      expect(position.top).toBeGreaterThanOrEqual(insetTop + VERTICAL_SPACING);
    });

    it('should position below anchor when there is enough space below safe area', () => {
      const anchor = { x: 100, y: 100, width: 40, height: 40 };
      const insetTop = 44;

      const position = getMenuPosition(anchor, insetTop);

      // Menu should be positioned below anchor
      // top = max(100 + 40 + 8, 44 + 8) = max(148, 52) = 148
      expect(position.top).toBe(148);
    });

    it('should handle zero safe area inset', () => {
      const anchor = { x: 100, y: 10, width: 40, height: 40 };
      const insetTop = 0;

      const position = getMenuPosition(anchor, insetTop);

      // top = max(10 + 40 + 8, 0 + 8) = max(58, 8) = 58
      expect(position.top).toBe(58);
    });
  });

  describe('edge cases', () => {
    it('should handle very wide screen', () => {
      mockDimensions.get.mockReturnValue({
        width: 1024, // iPad width
        height: 768,
        scale: 2,
        fontScale: 1,
      });

      const anchor = { x: 900, y: 50, width: 40, height: 40 };
      const insetTop = 44;

      const position = getMenuPosition(anchor, insetTop);

      // Should not overflow on wide screen
      // left = anchor.x + anchor.width - menuWidth = 900 + 40 - 180 = 760
      expect(position.left).toBe(760);
    });

    it('should handle very narrow screen', () => {
      mockDimensions.get.mockReturnValue({
        width: 320, // iPhone 5 width
        height: 568,
        scale: 2,
        fontScale: 1,
      });

      const anchor = { x: 200, y: 50, width: 40, height: 40 };
      const insetTop = 44;

      const position = getMenuPosition(anchor, insetTop);

      // On narrow screen, should still fit within bounds
      // max left = 320 - 180 - 16 = 124
      expect(position.left).toBeLessThanOrEqual(124);
      expect(position.left).toBeGreaterThanOrEqual(HORIZONTAL_PADDING);
    });

    it('should handle anchor with zero dimensions', () => {
      const anchor = { x: 100, y: 50, width: 0, height: 0 };
      const insetTop = 44;

      const position = getMenuPosition(anchor, insetTop);

      // Should still calculate valid position
      expect(position.top).toBe(58); // 50 + 0 + 8
      expect(position.left).toBeGreaterThanOrEqual(HORIZONTAL_PADDING);
      expect(position.left).toBeLessThanOrEqual(
        SCREEN_WIDTH - DEFAULT_MENU_WIDTH - HORIZONTAL_PADDING
      );
    });

    it('should handle large safe area inset', () => {
      const anchor = { x: 100, y: 50, width: 40, height: 40 };
      const insetTop = 100; // Very large inset (e.g., iPhone with Dynamic Island)

      const position = getMenuPosition(anchor, insetTop);

      // Should respect the large inset
      // top = max(50 + 40 + 8, 100 + 8) = max(98, 108) = 108
      expect(position.top).toBe(108);
    });
  });

  describe('consistency and invariants', () => {
    it('should always return valid coordinates within screen bounds', () => {
      const testCases = [
        { x: 0, y: 0, width: 40, height: 40 },
        { x: 375, y: 0, width: 40, height: 40 },
        { x: 187, y: 333, width: 40, height: 40 },
        { x: 10, y: 100, width: 100, height: 50 },
      ];

      testCases.forEach((anchor) => {
        const position = getMenuPosition(anchor, 44);

        expect(position.left).toBeGreaterThanOrEqual(HORIZONTAL_PADDING);
        expect(position.left + DEFAULT_MENU_WIDTH).toBeLessThanOrEqual(
          SCREEN_WIDTH - HORIZONTAL_PADDING
        );
        expect(position.top).toBeGreaterThanOrEqual(0);
      });
    });

    it('should return consistent results for same input', () => {
      const anchor = { x: 100, y: 50, width: 40, height: 40 };
      const insetTop = 44;

      const position1 = getMenuPosition(anchor, insetTop);
      const position2 = getMenuPosition(anchor, insetTop);

      expect(position1).toEqual(position2);
    });
  });
});
