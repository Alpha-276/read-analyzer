import { View, Text } from "react-native";

type StatCardProps = {
    value: string;
    label: string;
};

export default function StatCard({
                                     value,
                                     label,
                                 }: StatCardProps) {
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: "white",
                borderRadius: 16,
                padding: 20,
                alignItems: "center",

                shadowColor: "#000",
                shadowOpacity: 0.1,
                shadowRadius: 4,

                elevation: 2,
            }}
        >
            <Text
                style={{
                    fontSize: 28,
                    fontWeight: "bold",
                    color: "#4361ee",
                }}
            >
                {value}
            </Text>

            <Text
                style={{
                    color: "#64748b",
                    marginTop: 5,
                }}
            >
                {label}
            </Text>
        </View>
    );
}