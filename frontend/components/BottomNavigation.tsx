import { View, TouchableOpacity, Text } from "react-native";

type BottomNavigationProps = {
    setCurrentScreen: (screen: string) => void;
};

export default function BottomNavigation({
                                             setCurrentScreen,
                                         }: BottomNavigationProps) {
    return (
        <View
            style={{
                height: 125,
                paddingBottom: 20,

                backgroundColor: "#ffffff",

                borderTopWidth: 1,
                borderTopColor: "#e2e8f0",

                flexDirection: "row",

                shadowColor: "#000",
                shadowOpacity: 0.08,
                shadowRadius: 6,

                elevation: 8,
            }}
        >
            <TouchableOpacity
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                }}
                onPress={() => setCurrentScreen("home")}
            >
                <Text style={{ fontSize: 20 }}>🏠</Text>
                <Text
                    style={{
                        fontSize: 10,
                        color: "#64748b",
                        marginTop: 2,
                    }}
                >
                    Domov
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                }}
                onPress={() => setCurrentScreen("class")}
            >
                <Text style={{ fontSize: 20 }}>👥</Text>
                <Text
                    style={{
                        fontSize: 10,
                        color: "#64748b",
                        marginTop: 2,
                    }}
                >
                    Trieda
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                }}
                onPress={() => setCurrentScreen("record")}
            >
                <Text style={{ fontSize: 20 }}>🎙️</Text>
                <Text
                    style={{
                        fontSize: 10,
                        color: "#64748b",
                        marginTop: 2,
                    }}
                >
                    Čítanie
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                }}
                onPress={() => setCurrentScreen("recordings")}
            >
                <Text style={{ fontSize: 20 }}>🎤</Text>
                <Text
                    style={{
                        fontSize: 10,
                        color: "#64748b",
                        marginTop: 2,
                    }}
                >
                    Záznamy
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                }}
                onPress={() => setCurrentScreen("analysis")}
            >
                <Text style={{ fontSize: 20 }}>📊</Text>
                <Text
                    style={{
                        fontSize: 10,
                        color: "#64748b",
                        marginTop: 2,
                    }}
                >
                    Analýza
                </Text>
            </TouchableOpacity>
        </View>
    );
}