import { useEffect, useState } from "react";
import { View } from "react-native";

import HomeScreen from "./screens/HomeScreen";
import ClassScreen from "./screens/ClassScreen";
import RecordScreen from "./screens/RecordScreen";
import RecordingsScreen from "./screens/RecordingsScreen";
import AnalysisScreen from "./screens/AnalysisScreen";

import BottomNavigation from "./components/BottomNavigation";
import type { WavRecording } from "./services";

import { initializeDatabase, cleanupAbandonedRecordings } from "./services";


export default function App() {
    const [currentScreen, setCurrentScreen] =
        useState("home");

    const [lastRecording, setLastRecording] = useState<WavRecording | null>(null);

    useEffect(() => {
        try {
            const removed = cleanupAbandonedRecordings();
            if (removed > 0) console.log(`Removed ${removed} abandoned temporary WAV(s)`);
        } catch (error) {
            console.error("Failed to clean temporary WAV files:", error);
        }
        initializeDatabase()
            .then(() =>
                console.log("Database initialized")
            )
            .catch(console.error);
    }, []);

    const renderScreen = () => {


        switch (currentScreen) {
            case "class":
                return <ClassScreen />;

            case "record":
                return (
                    <RecordScreen
                        setCurrentScreen={setCurrentScreen}
                        onRecordingChange={setLastRecording}
                    />
                );

            case "recordings":
                return (
                    <RecordingsScreen
                        recording={lastRecording}
                        onConfirmed={uri => {
                            setLastRecording(previous => previous?.status === "pending"
                                ? { ...previous, uri, status: "saved" }
                                : previous);
                        }}
                    />
                );

            case "analysis":
                return <AnalysisScreen />;

            default:
                return (
                    <HomeScreen
                        setCurrentScreen={setCurrentScreen}
                    />
                );
        }
    };

    return (
        <View
            style={{
                flex: 1,
            }}
        >
            <View
                style={{
                    flex: 1,
                }}
            >
                {renderScreen()}
            </View>

            <BottomNavigation
                setCurrentScreen={setCurrentScreen}
            />
        </View>
    );
}