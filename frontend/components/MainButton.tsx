import { TouchableOpacity, Text } from "react-native";

type MainButtonProps = {
    title: string;
    color: string;
};

export default function MainButton({
                                       title,
                                       color,
                                   }: MainButtonProps) {
    return (
        <TouchableOpacity
            style={{
                width: 280,
                backgroundColor: color,
                padding: 18,
                borderRadius: 16,
                marginBottom: 15,
                alignItems: "center",
            }}
        >
            <Text
                style={{
                    color: "white",
                    fontSize: 18,
                    fontWeight: "600",
                }}
            >
                {title}
            </Text>
        </TouchableOpacity>
    );
}