import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import FeatureCard from "../components/FeatureCard";
import StatCard from "../components/StatCard";
import SyncControls from "../components/SyncControls";
import { getHomeStats, type HomeStats } from "../services/homeStats";
import { onSchoolDataChanged } from "../services/syncEvents";

type HomeScreenProps = {
    setCurrentScreen: (screen: string) => void;
};

export default function HomeScreen({
                                       setCurrentScreen,
                                   }: HomeScreenProps) {
    const [stats, setStats] = useState<HomeStats>({ classes: 0, students: 0, recordings: 0 });

    const refreshStats = useCallback(async () => {
        try {
            setStats(await getHomeStats());
        } catch (error) {
            console.error("Failed to load home statistics:", error);
        }
    }, []);

    useEffect(() => {
        void refreshStats();
        return onSchoolDataChanged(() => { void refreshStats(); });
    }, [refreshStats]);

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
                        marginBottom: 12,
                        color: "#1e293b",
                    }}
                >
                    Vitajte!
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
                    title="Manažment triedy"
                    icon={require("../assets/icons/people.png")}
                    onPress={() => setCurrentScreen("class")}
                />

                <FeatureCard
                    title="Spracovanie nahrávok"
                    icon={require("../assets/icons/download.png")}
                    onPress={() => setCurrentScreen("recordings")}
                />

                <FeatureCard
                    title="Spustiť čítanie"
                    icon={require("../assets/icons/microphone.png")}
                    onPress={() => setCurrentScreen("record")}
                />

                <FeatureCard
                    title="Google Drive"
                    icon={require("../assets/icons/google-drive.png")}
                    onPress={() => setCurrentScreen("drive")}
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
                        value={String(stats.classes)}
                        label="Triedy"
                    />

                    <StatCard
                        value={String(stats.students)}
                        label="Žiaci"
                    />

                    <StatCard
                        value={String(stats.recordings)}
                        label="Nahrávky"
                    />
                </View>


                <View style={{ width: "100%", marginTop: 20 }}>
                    <SyncControls onSynced={refreshStats} />
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