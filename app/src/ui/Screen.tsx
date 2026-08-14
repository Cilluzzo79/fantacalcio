import { View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "./theme";

export function Screen({ children, style, padded = true }: {
  children: React.ReactNode; style?: ViewStyle; padded?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg,
      paddingBottom: insets.bottom,
      paddingHorizontal: padded ? spacing(4) : 0 }, style]}>
      {children}
    </View>
  );
}
