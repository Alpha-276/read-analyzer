import { useEffect, useState } from "react";
import { View } from "react-native";

import HomeScreen from "./screens/HomeScreen";
import ClassScreen from "./screens/ClassScreen";
import RecordScreen from "./screens/RecordScreen";
import RecordingsScreen from "./screens/RecordingsScreen";
import GoogleDriveScreen from "./screens/GoogleDriveScreen";

import BottomNavigation from "./components/BottomNavigation";
import AutoSync from "./components/AutoSync";
import type { WavRecording } from "./services";

import { initializeDatabase, cleanupAbandonedRecordings, getLatestSavedRecording, resumeRecordingProcessing } from "./services";


export default function App() {
    const [currentScreen, setCurrentScreen] =
        useState("home");

    const [lastRecording, setLastRecording] = useState<WavRecording | null>(null);
    const [resumingTaskUri, setResumingTaskUri] = useState<string | null>(null);

    useEffect(() => {
        try {
            const removed = cleanupAbandonedRecordings();
            if (removed > 0) console.log(`Removed ${removed} abandoned temporary WAV(s)`);
        } catch (error) {
            console.error("Failed to clean temporary WAV files:", error);
        }
        initializeDatabase()
            .then(async () => {
                const previous = await getLatestSavedRecording();
                setLastRecording(current => current ?? previous);
                // A saved server task may have finished while the app was closed.
                // Only poll the known task; NEVER re-upload WAV automatically.
                if (previous?.taskId && previous.processingStatus !== 'done') {
                    setResumingTaskUri(previous.uri);
                    void resumeRecordingProcessing(previous, updated => {
                        setLastRecording(current =>
                            current?.uri === updated.uri ? updated : current
                        );
                    })
                        .catch(error => console.warn('Failed to resume ASR task:', error))
                        .finally(() => setResumingTaskUri(current =>
                            current === previous.uri ? null : current
                        ));
                }
            })
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

            case "drive":
                return <GoogleDriveScreen />;

            case "recordings":
                return (
                    <RecordingsScreen
                        recording={lastRecording}
                        resuming={resumingTaskUri === lastRecording?.uri}
                        onRecordingChange={next => setLastRecording(previous =>
                            previous?.uri === lastRecording?.uri || previous?.uri === next.uri
                                ? next
                                : previous
                        )}
                    />
                );

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
            <AutoSync />
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