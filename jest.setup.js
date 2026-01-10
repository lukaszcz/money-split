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

  const FlatList = ({ data = [], renderItem, keyExtractor }) =>
    React.createElement(
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

  return {
    View: createMockComponent('View'),
    Text: createMockComponent('Text'),
    TextInput: createMockComponent('TextInput'),
    ScrollView: createMockComponent('ScrollView'),
    TouchableOpacity: createMockComponent('TouchableOpacity'),
    KeyboardAvoidingView: createMockComponent('KeyboardAvoidingView'),
    Image: createMockComponent('Image'),
    Switch: createMockComponent('Switch'),
    ActivityIndicator: createMockComponent('ActivityIndicator'),
    Modal: createMockComponent('Modal'),
    RefreshControl: createMockComponent('RefreshControl'),
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
  if (
    typeof args[0] === 'string' &&
    args[0].includes('react-test-renderer is deprecated')
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

jest.mock('./assets/images/moneysplit.jpg', () => 1);
