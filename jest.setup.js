if (typeof BigInt === 'function') {
  BigInt.prototype.toJSON = function() {
    return this.toString();
  };
}

global.__DEV__ = true;

jest.mock('react-native', () => {
  const React = require('react');
  const createMockComponent = (name) =>
    React.forwardRef((props, ref) =>
      React.createElement(name, { ...props, ref }, props.children),
    );

  const FlatList = ({
    data = [],
    renderItem,
    keyExtractor,
    ListEmptyComponent,
  }) => {
    if (data.length === 0 && ListEmptyComponent) {
      const emptyElement = React.isValidElement(ListEmptyComponent)
        ? ListEmptyComponent
        : React.createElement(ListEmptyComponent);
      return React.createElement(React.Fragment, null, emptyElement);
    }

    return React.createElement(
      React.Fragment,
      null,
      data.map((item, index) => {
        const element = renderItem ? renderItem({ item, index }) : null;
        if (React.isValidElement(element)) {
          const key = keyExtractor ? keyExtractor(item, index) : `${index}`;
          return React.cloneElement(element, { key });
        }
        return element;
      }),
    );
  };

  return {
    View: createMockComponent('View'),
    Text: createMockComponent('Text'),
    TextInput: createMockComponent('TextInput'),
    ScrollView: createMockComponent('ScrollView'),
    TouchableOpacity: createMockComponent('TouchableOpacity'),
    Pressable: createMockComponent('Pressable'),
    KeyboardAvoidingView: createMockComponent('KeyboardAvoidingView'),
    Image: createMockComponent('Image'),
    Switch: createMockComponent('Switch'),
    ActivityIndicator: createMockComponent('ActivityIndicator'),
    Modal: createMockComponent('Modal'),
    RefreshControl: createMockComponent('RefreshControl'),
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 667 })),
    },
    FlatList,
    StyleSheet: {
      create: (styles) => styles,
      flatten: (style) => {
        if (!style) {
          return style;
        }
        if (Array.isArray(style)) {
          return style.reduce((acc, item) => ({ ...acc, ...(item || {}) }), {});
        }
        return style;
      },
    },
    Platform: {
      OS: 'ios',
      select: (options) => options.ios ?? options.default,
    },
    Alert: {
      alert: jest.fn(),
    },
  };
});

const originalConsoleError = console.error;
console.error = (...args) => {
  const firstArg = typeof args[0] === 'string' ? args[0] : '';
  if (
    firstArg.includes('react-test-renderer is deprecated') ||
    firstArg.includes(
      'Recovery verification and temporary password assignment failed:',
    )
  ) {
    return;
  }
  originalConsoleError(...args);
};

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const MockProvider = ({ children }) =>
    React.createElement(React.Fragment, null, children);
  return {
    SafeAreaView: MockProvider,
    SafeAreaProvider: MockProvider,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('lucide-react-native', () => {
  const MockIcon = () => null;
  return new Proxy(
    {},
    {
      get: () => MockIcon,
    },
  );
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn((byteCount) => {
    const bytes = new Uint8Array(byteCount);
    for (let index = 0; index < byteCount; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
    return bytes;
  }),
}));

jest.mock('./assets/images/moneysplit.jpg', () => 1);
