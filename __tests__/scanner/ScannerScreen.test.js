import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import ScannerScreen from '../../app/screens/ScannerScreen';

const mockRequestPermission = jest.fn();
const mockTakePictureAsync = jest.fn();

jest.mock('expo-camera', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return {
    CameraView: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        takePictureAsync: mockTakePictureAsync,
      }));

      return (
        <View testID="camera-view">
          <Text>Mock Camera</Text>
          {props.children}
        </View>
      );
    }),
    Camera: {
      requestCameraPermissionsAsync: mockRequestPermission,
    },
    useCameraPermissions: jest.fn(() => [
      {
        granted: true,
      },
      mockRequestPermission,
    ]),
  };
});

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
          },
        },
        error: null,
      }),
    },
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    })),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({
          data: {
            path: 'test-receipt.jpg',
          },
          error: null,
        }),
        getPublicUrl: jest.fn(() => ({
          data: {
            publicUrl: 'https://example.com/test-receipt.jpg',
          },
        })),
      })),
    },
  },
}));

describe('ScannerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockRequestPermission.mockResolvedValue({
      granted: true,
    });

    mockTakePictureAsync.mockResolvedValue({
      uri: 'file://test-receipt.jpg',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders the scanner screen without crashing', () => {
    const { toJSON } = render(<ScannerScreen />);

    expect(toJSON()).toBeTruthy();
  });

  test('requests camera permission when the permission button is pressed', async () => {
    const expoCamera = require('expo-camera');
    expoCamera.useCameraPermissions.mockReturnValueOnce([
      {
        granted: false,
      },
      mockRequestPermission,
    ]);

    const { getByText } = render(<ScannerScreen />);

    const permissionButton = getByText(/permission/i);
    fireEvent.press(permissionButton);

    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalled();
    });
  });

  test('renders the mocked camera when permission is granted', () => {
    const { getByTestId } = render(<ScannerScreen />);

    expect(getByTestId('camera-view')).toBeTruthy();
  });

  test('captures a photo without using Gemini', async () => {
    const { UNSAFE_getByType, findByText } = render(<ScannerScreen />);
    const { TouchableOpacity } = require('react-native');

    fireEvent.press(UNSAFE_getByType(TouchableOpacity));

    await waitFor(() => {
      expect(mockTakePictureAsync).toHaveBeenCalledWith({
        base64: true,
        quality: 0.7,
      });
    });

    expect(await findByText(/2\. analyze with llm/i)).toBeTruthy();
  });
});