import { TouchableOpacity, View, Text, Image, type ImageSourcePropType } from "react-native";

type FeatureCardProps = {
    title: string;
    icon: ImageSourcePropType;
    onPress?: () => void;
};

export default function FeatureCard({ title, icon, onPress }: FeatureCardProps) {
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
                shadowOffset: { width: 0, height: 2 },
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
                        <Image
                            source={icon}
                            resizeMode="contain"
                            style={{ width: 30, height: 30, tintColor: "#3b82f6" }}
                        />
                    </View>

                    <View style={{ flex: 1, justifyContent: "center" }}>
                        <Text
                            style={{
                                color: "#1e293b",
                                fontSize: 18,
                                fontWeight: "700",
                            }}
                        >
                            {title}
                        </Text>
                    </View>
                </View>

                <Text
                    style={{
                        color: "#3b82f6",
                        fontSize: 42,
                        marginLeft: 8,
                    }}
                >
                    ›
                </Text>
            </View>
        </TouchableOpacity>
    );
}
