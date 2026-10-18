import { View, Text, ScrollView } from "react-native";
import FeatureCard from "../components/FeatureCard";
import StatCard from "../components/StatCard";

type HomeScreenProps = {
    setCurrentScreen: (screen: string) => void;
};

export default function HomeScreen({
                                       setCurrentScreen,
                                   }: HomeScreenProps) {
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: "#f8fafc",
            }}
        >
            {/* Header */}

            <View
                style={{
                    width: "100%",
                    backgroundColor: "#3b82f6",
                    paddingTop: 45,
                    paddingBottom: 20,
                    alignItems: "center",
                }}
            >
                <Text
                    style={{
                        color: "white",
                        fontSize: 24,
                        fontWeight: "bold",
                    }}
                >
                    ČítamDobre
                </Text>
            </View>

            {/* Scrollable Content */}

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    width: "100%",
                    maxWidth: 420,
                    alignSelf: "center",
                    alignItems: "center",
                    padding: 20,
                    paddingBottom: 40,
                }}
            >
                {/* Logo */}

                <View
                    style={{
                        width: 75,
                        height: 75,
                        borderRadius: 20,
                        backgroundColor: "#3b82f6",
                        justifyContent: "center",
                        alignItems: "center",
                        marginTop: 10,

                        shadowColor: "#000",
                        shadowOpacity: 0.08,
                        shadowRadius: 8,

                        elevation: 4,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 36,
                        }}
                    >
                        📖
                    </Text>
                </View>

                {/* Welcome */}

                <Text
                    style={{
                        fontSize: 30,
                        fontWeight: "700",
                        marginTop: 15,
                        color: "#1e293b",
                    }}
                >
                    Vitajte
                </Text>

                <Text
                    style={{
                        fontSize: 15,
                        color: "#64748b",
                        marginBottom: 25,
                        textAlign: "center",
                    }}
                >
                    Aplikácia na hodnotenie čítania
                </Text>

                {/* Feature Cards */}

                <FeatureCard
                    title="Vytvoriť triedu"
                    subtitle="Spravovať žiakov a skupiny"
                    icon="👥"
                    onPress={() => setCurrentScreen("class")}
                />

                <FeatureCard
                    title="Nahrávky"
                    subtitle="Nahrávanie čítania žiakov"
                    icon="🎤"
                    onPress={() => setCurrentScreen("recordings")}
                />

                <FeatureCard
                    title="Spustiť čítanie"
                    subtitle="Analýza a hodnotenie výkonu"
                    icon="📊"
                    onPress={() => setCurrentScreen("record")}
                />

                {/* Statistics */}

                <View
                    style={{
                        flexDirection: "row",
                        width: "100%",
                        gap: 10,
                        marginTop: 20,
                    }}
                >
                    <StatCard
                        value="3"
                        label="Žiaci"
                    />

                    <StatCard
                        value="7"
                        label="Nahrávky"
                    />

                    <StatCard
                        value="5"
                        label="Analýzy"
                    />
                </View>


                <View
                    style={{
                        height: 40,
                    }}
                />
            </ScrollView>
        </View>
    );
}