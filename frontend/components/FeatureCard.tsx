import { TouchableOpacity, View, Text } from "react-native";

type FeatureCardProps = {
    title: string;
    subtitle: string;
    icon: string;
    onPress?: () => void;
};

export default function FeatureCard({
                                        title,
                                        subtitle,
                                        icon,
                                        onPress,
                                    }: FeatureCardProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            style={{
                width: "100%",
                backgroundColor: "#ffffff",
                borderRadius: 18,
                padding: 18,
                marginBottom: 12,

                shadowColor: "#000",
                shadowOpacity: 0.08,
                shadowRadius: 6,

                shadowOffset: {
                    width: 0,
                    height: 2,
                },

                elevation: 3,
            }}
        >
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flex: 1,
                    }}
                >
                    <View
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: 14,
                            backgroundColor: "#dbeafe",
                            justifyContent: "center",
                            alignItems: "center",
                            marginRight: 15,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 24,
                            }}
                        >
                            {icon}
                        </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                        <Text
                            style={{
                                color: "#1e293b",
                                fontSize: 18,
                                fontWeight: "700",
                            }}
                        >
                            {title}
                        </Text>

                        <Text
                            style={{
                                color: "#64748b",
                                marginTop: 3,
                                fontSize: 13,
                            }}
                        >
                            {subtitle}
                        </Text>
                    </View>
                </View>

                <Text
                    style={{
                        color: "#94a3b8",
                        fontSize: 28,
                    }}
                >
                    ›
                </Text>
            </View>
        </TouchableOpacity>
    );
}